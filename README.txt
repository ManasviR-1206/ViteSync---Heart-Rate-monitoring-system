╔══════════════════════════════════════════════════════════════╗
║              VitalSync rPPG — v3  Full Stack                 ║
║         Contactless Heart Rate via Browser Camera            ║
╚══════════════════════════════════════════════════════════════╝

── TECH STACK ──────────────────────────────────────────────────

  Frontend:   React 18 + TypeScript + Vite
  Styling:    Inline styles + Framer Motion animations
  Charts:     Recharts (live waveform + BPM history)
  Face AI:    MediaPipe Face Mesh (468 landmarks, CDN)
  Transport:  Socket.IO WebSocket (real-time signal stream)

  Backend:    Flask + Flask-SocketIO (Python)
  DSP:        SciPy Butterworth bandpass + Welch PSD
  Algorithm:  rPPG — green/red channel → FFT → BPM

── FEATURES ────────────────────────────────────────────────────

  ✅ Real BPM from webcam (rPPG algorithm)
  ✅ MediaPipe Face Mesh — 468 landmark precision ROI
  ✅ Multi-face detection — warns if >1 person, measures #1 only
  ✅ Trust Score (0–100) with 6 live factors:
       • Face detected
       • Single person
       • Motion stable
       • Good lighting
       • Signal quality
       • Buffer ready
  ✅ SpO₂ estimate (R/G ratio method)
  ✅ HRV / RMSSD from BPM history
  ✅ Live green channel waveform (Recharts AreaChart)
  ✅ BPM history chart with session MIN/AVG/MAX
  ✅ Motion detection (rejects noisy frames)
  ✅ Lighting quality check
  ✅ Signal quality progress bar
  ✅ Framer Motion micro-animations
  ✅ Backend health API at /health

── HOW TO RUN ──────────────────────────────────────────────────

  Requirements:
    • Python 3.9+   → python.org
    • Node.js 18+   → nodejs.org

  Mac / Linux (one command):
    chmod +x start.sh
    ./start.sh

  Windows (double-click):
    start.bat

  Manual:
    # Terminal 1 — Backend
    cd backend
    python -m venv venv
    source venv/bin/activate      # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    python app.py

    # Terminal 2 — Frontend
    cd frontend
    npm install --legacy-peer-deps
    npm run dev

  Then open: http://localhost:3000

── ALGORITHM ───────────────────────────────────────────────────

  1. MediaPipe extracts 468 face landmarks at ~30fps
  2. ROI pixels sampled from forehead (10 pts) + cheeks (10 pts)
  3. Mean R + G channel per frame sent to Flask via WebSocket
  4. Backend pipeline:
       • Linear detrend (remove DC drift)
       • Z-normalization
       • 4th-order Butterworth bandpass (0.7–4.0 Hz)
       • Welch PSD with 50% overlapping Hann windows
       • Peak frequency in band → × 60 = BPM
       • Median smoothing over last 10 estimates
  5. SpO₂: (R_ac/R_dc) / (G_ac/G_dc) ratio → 110 – 25R
  6. HRV: RMSSD from BPM inter-beat intervals
  7. Trust Score: weighted sum of 7 real-time factors

── TRUST SCORE ─────────────────────────────────────────────────

  Factor              Weight   Condition
  ─────────────────── ──────   ──────────────────────────────
  Face Detected          25    MediaPipe sees ≥1 face
  Single Person          20    Exactly 1 face in frame
  Motion Stable          20    Nose landmark <0.012 delta
  Good Lighting          10    Frame brightness 40–230
  Buffer Filled          10    ≥300 frames in buffer
  Signal Quality       0–10    Welch SNR score
  Frame Rate           0–5     Camera ≥ 30fps
  ─────────────────── ──────
  Max score:           100

  ≥70 = HIGH CONFIDENCE (green)
  40–70 = MODERATE (amber)
  <40 = LOW (red)

── TIPS FOR BEST ACCURACY ──────────────────────────────────────

  ✅ Sit still — motion is the #1 accuracy killer
  ✅ Face a window or lamp directly
  ✅ Keep full face visible to camera
  ✅ Use Chrome or Edge (best WebRTC + WebGL)
  ✅ Wait 8–10 seconds for stable BPM
  ✅ Trust score ≥70 before trusting the reading

── FILE STRUCTURE ──────────────────────────────────────────────

  rppg-vitalsync-v3/
  ├── start.sh                 Mac/Linux one-click start
  ├── start.bat                Windows one-click start
  ├── README.txt               This file
  │
  ├── backend/
  │   ├── app.py               Flask + Socket.IO server
  │   ├── rppg_processor.py    SciPy DSP pipeline
  │   └── requirements.txt     Python dependencies
  │
  └── frontend/
      ├── index.html           Entry HTML (loads MediaPipe CDN)
      ├── vite.config.ts       Vite + proxy config
      ├── package.json
      ├── tsconfig.json
      └── src/
          ├── main.tsx
          ├── index.css
          ├── App.tsx           Main UI (all panels)
          ├── hooks/
          │   └── useRPPG.ts    MediaPipe + Socket.IO logic
          ├── components/
          │   ├── TrustScoreRing.tsx   SVG ring chart
          │   ├── SignalChart.tsx      Recharts waveforms
          │   └── StatusBadge.tsx     Status indicator
          └── types/
              └── index.ts

── NOTE ────────────────────────────────────────────────────────

  rPPG is a research-grade technique. Accuracy: ±5–12 BPM vs
  medical pulse oximeter. Not for clinical or medical decisions.
  For demos, DMS projects, and wellness monitoring only.
