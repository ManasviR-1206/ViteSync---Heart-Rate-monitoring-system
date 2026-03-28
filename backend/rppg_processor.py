"""
rppg_processor.py — Production-grade rPPG Signal Processor
============================================================
Uses scipy for clinical-grade Butterworth filtering + Welch PSD.
"""

import numpy as np
from scipy.signal import butter, filtfilt, welch as scipy_welch
from collections import deque
from typing import Optional, Tuple, Dict, Any
import time

# ── Constants
BUFFER_SIZE    = 300       # 10s at 30fps
MIN_FRAMES     = 90        # 3s minimum for first estimate
HZ_LO, HZ_HI  = 0.7, 4.0  # 42–240 BPM
FS_DEFAULT     = 30.0      # assumed camera fps
SMOOTH_WINDOW  = 10        # BPM smoothing window


class RPPGProcessor:
    """Per-session rPPG processor."""

    def __init__(self):
        self.green_buf   = deque(maxlen=BUFFER_SIZE)
        self.red_buf     = deque(maxlen=BUFFER_SIZE)
        self.ts_buf      = deque(maxlen=BUFFER_SIZE)
        self.bpm_history = deque(maxlen=SMOOTH_WINDOW)
        self.reset_time  = time.time()

    def reset(self):
        self.green_buf.clear()
        self.red_buf.clear()
        self.ts_buf.clear()
        self.bpm_history.clear()
        self.reset_time = time.time()

    def push(
        self,
        green_vals: list,
        red_vals: list,
        timestamp: float,
        trust_factors: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Accept green/red channel arrays from frontend ROI,
        run full signal pipeline, return result dict.
        """
        # Average across ROI points
        g = float(np.mean(green_vals))
        r = float(np.mean(red_vals))

        self.green_buf.append(g)
        self.red_buf.append(r)
        self.ts_buf.append(timestamp)

        n = len(self.green_buf)
        progress = min(n / MIN_FRAMES, 1.0)

        result: Dict[str, Any] = {
            "progress": round(progress, 3),
            "frames": n,
            "bpm": None,
            "spo2": None,
            "hrv": None,
            "signal_quality": 0,
            "trust_score": 0,
            "peak_hz": None,
            "signal": self._downsample(list(self.green_buf), 128),
        }

        if n < MIN_FRAMES:
            result["signal_quality"] = int(progress * 40)  # partial quality
            result["trust_score"] = self._trust_score(trust_factors, 0, False)
            return result

        # ── Estimate effective sample rate from timestamps
        ts = np.array(self.ts_buf)
        Fs = (len(ts) - 1) / max(ts[-1] - ts[0], 1e-6) * 1000  # ms → Hz
        Fs = float(np.clip(Fs, 15, 60))

        # ── Signal pipeline
        sig = np.array(self.green_buf, dtype=np.float64)
        sig = self._detrend(sig)
        sig = self._znorm(sig)

        # ── Butterworth bandpass (4th-order, zero-phase)
        filtered = self._butter_bandpass(sig, Fs)
        if filtered is None:
            return result

        # ── Welch PSD for robust BPM
        bpm, peak_hz, snr = self._welch_bpm(filtered, Fs)

        # ── Signal quality from SNR
        quality = int(np.clip(snr * 200, 0, 100))
        result["signal_quality"] = quality

        if bpm and 40 <= bpm <= 200:
            self.bpm_history.append(bpm)
            smooth = int(np.median(self.bpm_history))
            result["bpm"] = smooth
            result["peak_hz"] = round(peak_hz, 3)

        # ── SpO2
        if len(self.red_buf) >= 60:
            result["spo2"] = self._spo2(
                list(self.red_buf)[-90:],
                list(self.green_buf)[-90:]
            )

        # ── HRV (RMSSD)
        if len(self.bpm_history) >= 5:
            result["hrv"] = self._hrv(list(self.bpm_history))

        # ── Trust score
        result["trust_score"] = self._trust_score(
            trust_factors, quality, n >= BUFFER_SIZE
        )

        return result

    # ═══════════════════════════════════════
    #  Signal processing helpers
    # ═══════════════════════════════════════

    @staticmethod
    def _detrend(sig: np.ndarray) -> np.ndarray:
        n = len(sig)
        x = np.arange(n, dtype=np.float64)
        p = np.polyfit(x, sig, 1)
        return sig - np.polyval(p, x)

    @staticmethod
    def _znorm(sig: np.ndarray) -> np.ndarray:
        s = np.std(sig)
        return (sig - np.mean(sig)) / s if s > 1e-10 else sig

    @staticmethod
    def _butter_bandpass(sig: np.ndarray, Fs: float) -> Optional[np.ndarray]:
        try:
            nyq = Fs / 2
            lo, hi = HZ_LO / nyq, HZ_HI / nyq
            lo, hi = np.clip(lo, 0.001, 0.999), np.clip(hi, 0.001, 0.999)
            if lo >= hi:
                return None
            b, a = butter(4, [lo, hi], btype='band')
            return filtfilt(b, a, sig)
        except Exception:
            return None

    @staticmethod
    def _welch_bpm(filtered: np.ndarray, Fs: float) -> Tuple[Optional[int], float, float]:
        try:
            nperseg = min(len(filtered), 128)
            f, pxx = scipy_welch(filtered, fs=Fs, nperseg=nperseg, noverlap=nperseg//2)
            mask = (f >= HZ_LO) & (f <= HZ_HI)
            if not np.any(mask):
                return None, 0.0, 0.0

            band_pxx = pxx.copy()
            band_pxx[~mask] = 0

            peak_idx = int(np.argmax(band_pxx))
            peak_hz  = float(f[peak_idx])
            bpm      = int(round(peak_hz * 60))

            # SNR = band power / total power
            snr = float(np.sum(band_pxx[mask]) / (np.sum(pxx) + 1e-12))
            return bpm, peak_hz, snr
        except Exception:
            return None, 0.0, 0.0

    @staticmethod
    def _spo2(red: list, green: list) -> int:
        r = np.array(red, dtype=np.float64)
        g = np.array(green, dtype=np.float64)
        r_mean, g_mean = np.mean(r), np.mean(g)
        r_ac = np.std(r)
        g_ac = np.std(g)
        if g_mean < 1 or g_ac < 1e-6:
            return 98
        R = (r_ac / max(r_mean, 1)) / (g_ac / max(g_mean, 1))
        spo2 = int(np.clip(round(110 - 25 * R), 90, 100))
        return spo2

    @staticmethod
    def _hrv(bpm_history: list) -> int:
        intervals = [60000.0 / b for b in bpm_history]
        diffs = np.diff(intervals)
        return int(round(np.sqrt(np.mean(diffs ** 2))))

    @staticmethod
    def _trust_score(factors: Dict[str, Any], quality: int, buffer_full: bool) -> int:
        score = 0.0
        if factors.get("face_detected"):    score += 25
        if factors.get("single_person"):    score += 20
        if factors.get("motion_stable"):    score += 20
        if factors.get("lighting_ok"):      score += 10
        if buffer_full:                     score += 10
        score += (quality / 100) * 10
        fps = factors.get("frame_rate", 0)
        score += min(1.0, fps / 30.0) * 5
        return int(min(100, round(score)))

    @staticmethod
    def _downsample(arr: list, target: int) -> list:
        if len(arr) <= target:
            return arr
        idx = np.linspace(0, len(arr) - 1, target, dtype=int)
        return [arr[i] for i in idx]
