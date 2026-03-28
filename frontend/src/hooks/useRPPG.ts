import { useRef, useState, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import type {
  MeasurementStatus,
  VitalReading,
  PersonDetection,
  MotionState,
  TrustFactors,
  RPPGResult,
} from "../types";

// ── ROI landmark indices (MediaPipe Face Mesh 468 pts)
const FOREHEAD_LANDMARKS = [10, 338, 297, 332, 284, 251, 108, 69, 67, 109];
const LEFT_CHEEK_LANDMARKS = [234, 93, 132, 58, 172];
const RIGHT_CHEEK_LANDMARKS = [454, 323, 361, 288, 397];
const ALL_ROI = [...FOREHEAD_LANDMARKS, ...LEFT_CHEEK_LANDMARKS, ...RIGHT_CHEEK_LANDMARKS];

const FACE_OUTLINE = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

const SEND_INTERVAL_MS = 100; // send signal every 100ms (~10 Hz to backend)
const BUFFER_SIZE = 300;

export function useRPPG(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>
) {
  // ── Vitals state
  const [bpm,          setBpm]          = useState<number | null>(null);
  const [spo2,         setSpo2]         = useState<number>(98);
  const [hrv,          setHrv]          = useState<number>(0);
  const [trustScore,   setTrustScore]   = useState<number>(0);
  const [signalQuality,setSignalQuality]= useState<number>(0);
  const [progress,     setProgress]     = useState<number>(0);
  const [status,       setStatus]       = useState<MeasurementStatus>("idle");
  const [frameRate,    setFrameRate]    = useState<number>(0);
  const [lightingOk,   setLightingOk]  = useState<boolean>(false);
  const [connected,    setConnected]    = useState<boolean>(false);
  const [personDetection, setPersonDetection] = useState<PersonDetection>({
    detected: false, count: 0, warning: null,
  });
  const [motionState,  setMotionState]  = useState<MotionState>({ stable: true, magnitude: 0 });
  const [history,      setHistory]      = useState<VitalReading[]>([]);
  const [liveSignal,   setLiveSignal]   = useState<number[]>([]);

  // ── Internal refs (don't trigger re-renders)
  const socketRef       = useRef<Socket | null>(null);
  const faceMeshRef     = useRef<any>(null);
  const cameraRef       = useRef<any>(null);
  const isRunningRef    = useRef(false);
  const prevLandmarkRef = useRef<{ x: number; y: number } | null>(null);
  const frameCountRef   = useRef(0);
  const lastFpsTimeRef  = useRef(Date.now());
  const lastSendRef     = useRef(0);
  const greenBufRef     = useRef<number[]>([]);
  const redBufRef       = useRef<number[]>([]);

  // ── Connect socket on mount
  useEffect(() => {
    const socket = io({ transports: ["polling", "websocket"], reconnection: true });
    socketRef.current = socket;

    socket.on("connect",       () => setConnected(true));
    socket.on("disconnect",    () => setConnected(false));
    socket.on("server_ready",  () => console.log("[VS] Backend ready"));
    socket.on("reset_done",    () => resetState());

    socket.on("result", (data: RPPGResult) => {
      setProgress(data.progress);
      setSignalQuality(data.signal_quality);
      setTrustScore(data.trust_score);
      if (data.signal?.length) setLiveSignal(data.signal);

      if (data.bpm !== null && data.bpm !== undefined) {
        setBpm(data.bpm);
        setStatus("measuring");
        if (data.spo2) setSpo2(data.spo2);
        if (data.hrv)  setHrv(data.hrv);

        // append to history (max 120 readings)
        const reading: VitalReading = {
          timestamp:  Date.now(),
          bpm:        data.bpm,
          spo2:       data.spo2 ?? 98,
          hrv:        data.hrv  ?? 0,
          quality:    data.signal_quality,
          trustScore: data.trust_score,
        };
        setHistory(prev => [...prev.slice(-119), reading]);
      } else if (data.progress < 1) {
        setStatus("calibrating");
      }
    });

    socket.on("error", (e: { message: string }) => {
      console.error("[VS] Socket error:", e.message);
    });

    return () => { socket.disconnect(); };
  }, []);

  // ── MediaPipe frame handler
  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFrameRate(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // Draw frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // Lighting check (sample center area)
    const sample = ctx.getImageData(
      canvas.width/4, canvas.height/4,
      canvas.width/2, canvas.height/2
    );
    const brightness = checkBrightness(sample.data);
    const lighting   = brightness > 40 && brightness < 230;
    setLightingOk(lighting);

    // Face detection
    const numFaces = results.multiFaceLandmarks?.length ?? 0;
    setPersonDetection({
      detected: numFaces > 0,
      count:    numFaces,
      warning:  numFaces === 0
        ? "No face detected — position face in frame"
        : numFaces > 1
        ? `${numFaces} faces detected — measuring person #1 only`
        : null,
    });

    if (numFaces === 0) {
      prevLandmarkRef.current = null;
      return;
    }

    // Use first face only
    const landmarks = results.multiFaceLandmarks[0];
    const W = canvas.width, H = canvas.height;

    // Motion detection
    const nose = landmarks[1];
    let stable = true;
    let magnitude = 0;
    if (prevLandmarkRef.current) {
      const dx = nose.x - prevLandmarkRef.current.x;
      const dy = nose.y - prevLandmarkRef.current.y;
      magnitude = Math.sqrt(dx*dx + dy*dy);
      stable    = magnitude < 0.012;
    }
    prevLandmarkRef.current = { x: nose.x, y: nose.y };
    setMotionState({ stable, magnitude: Math.round(magnitude * 1000) });

    // Draw face overlay
    drawFaceOverlay(ctx, landmarks, W, H, numFaces > 1, stable);

    // Skip noisy frames
    if (!stable) return;

    // Extract ROI pixels
    const greenVals: number[] = [];
    const redVals:   number[] = [];

    for (const idx of ALL_ROI) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const px = Math.round(lm.x * W);
      const py = Math.round(lm.y * H);
      const sz = 14;
      if (px < sz || py < sz || px > W-sz || py > H-sz) continue;
      const pixel = ctx.getImageData(px - sz/2, py - sz/2, sz, sz).data;
      let r = 0, g = 0, cnt = 0;
      for (let i = 0; i < pixel.length; i += 4) {
        r += pixel[i]; g += pixel[i+1]; cnt++;
      }
      if (cnt > 0) {
        redVals.push(r/cnt);
        greenVals.push(g/cnt);
      }
    }

    if (greenVals.length === 0) return;

    // Buffer locally
    const avgG = greenVals.reduce((a,b)=>a+b,0) / greenVals.length;
    const avgR = redVals.reduce((a,b)=>a+b,0)   / redVals.length;
    greenBufRef.current.push(avgG);
    redBufRef.current.push(avgR);
    if (greenBufRef.current.length > BUFFER_SIZE) greenBufRef.current.shift();
    if (redBufRef.current.length   > BUFFER_SIZE) redBufRef.current.shift();

    // Send to backend at controlled rate
    if (now - lastSendRef.current >= SEND_INTERVAL_MS && socketRef.current?.connected) {
      lastSendRef.current = now;
      const trustFactors: TrustFactors = {
        face_detected:  true,
        single_person:  numFaces === 1,
        motion_stable:  stable,
        lighting_ok:    lighting,
        frame_rate:     frameCountRef.current,
      };
      socketRef.current.emit("signal", {
        green_vals:    greenVals,
        red_vals:      redVals,
        timestamp:     now,
        trust_factors: trustFactors,
      });
    }
  }, [canvasRef, videoRef]);

  // ── Start
  const start = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setStatus("initializing");

    // Wait for MediaPipe globals (loaded via CDN script tags)
    let attempts = 0;
    while ((!window.FaceMesh || !window.Camera) && attempts++ < 30) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!window.FaceMesh || !window.Camera) {
      setStatus("error");
      console.error("[VS] MediaPipe not loaded from CDN");
      return;
    }

    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces:          4,
      refineLandmarks:      true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence:  0.7,
    });

    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;

    const cam = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && isRunningRef.current) {
          await faceMesh.send({ image: videoRef.current });
        }
      },
      width: 640, height: 480,
    });
    cameraRef.current = cam;
    try {
      await cam.start();
    } catch (err) {
      console.error("[VS] Camera start failed:", err);
      setStatus("error");
      isRunningRef.current = false;
    }
  }, [onResults, videoRef]);

  // ── Stop
  const stop = useCallback(() => {
    isRunningRef.current = false;
    cameraRef.current?.stop();
    setStatus("paused");
  }, []);

  // ── Reset
  const resetState = useCallback(() => {
    greenBufRef.current = [];
    redBufRef.current   = [];
    prevLandmarkRef.current = null;
    setBpm(null); setSpo2(98); setHrv(0);
    setTrustScore(0); setSignalQuality(0); setProgress(0);
    setLiveSignal([]); setHistory([]);
    setStatus("initializing");
  }, []);

  const reset = useCallback(() => {
    resetState();
    socketRef.current?.emit("reset");
  }, [resetState]);

  return {
    bpm, spo2, hrv, trustScore, signalQuality, progress,
    status, frameRate, lightingOk, connected,
    personDetection, motionState, history, liveSignal,
    start, stop, reset,
  };
}

// ── Helpers

function checkBrightness(data: Uint8ClampedArray): number {
  let total = 0, count = 0;
  for (let i = 0; i < data.length; i += 16) {
    total += (data[i] + data[i+1] + data[i+2]) / 3;
    count++;
  }
  return count ? total/count : 0;
}

function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  W: number, H: number,
  isExtra: boolean,
  stable: boolean
) {
  // Bounding box
  let minX=1, maxX=0, minY=1, maxY=0;
  FACE_OUTLINE.forEach(idx => {
    if (!landmarks[idx]) return;
    minX = Math.min(minX, landmarks[idx].x);
    maxX = Math.max(maxX, landmarks[idx].x);
    minY = Math.min(minY, landmarks[idx].y);
    maxY = Math.max(maxY, landmarks[idx].y);
  });

  const bx = (1 - maxX) * W - 10;
  const by = minY * H - 10;
  const bw = (maxX - minX) * W + 20;
  const bh = (maxY - minY) * H + 20;

  const col = isExtra ? "#ff4455" : stable ? "#00e5b0" : "#ffb800";
  const tk  = 22;

  ctx.strokeStyle = col;
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = col;
  ctx.shadowBlur  = 12;

  // TL
  ctx.beginPath(); ctx.moveTo(bx, by+tk); ctx.lineTo(bx,by); ctx.lineTo(bx+tk,by); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(bx+bw-tk,by); ctx.lineTo(bx+bw,by); ctx.lineTo(bx+bw,by+tk); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(bx,by+bh-tk); ctx.lineTo(bx,by+bh); ctx.lineTo(bx+tk,by+bh); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(bx+bw-tk,by+bh); ctx.lineTo(bx+bw,by+bh); ctx.lineTo(bx+bw,by+bh-tk); ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle  = col;
  ctx.font       = "bold 11px 'JetBrains Mono', monospace";
  ctx.fillText(
    isExtra ? "⚠ EXTRA FACE" : stable ? "● PRIMARY" : "⚡ MOTION",
    bx, by - 8
  );

  // Highlight ROI dots
  ctx.shadowBlur  = 6;
  ctx.shadowColor = "#00e5b0";
  ctx.fillStyle   = "rgba(0,229,176,0.6)";
  [...FOREHEAD_LANDMARKS, ...LEFT_CHEEK_LANDMARKS, ...RIGHT_CHEEK_LANDMARKS].forEach(idx => {
    if (!landmarks[idx]) return;
    const px = (1 - landmarks[idx].x) * W;
    const py = landmarks[idx].y * H;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}
