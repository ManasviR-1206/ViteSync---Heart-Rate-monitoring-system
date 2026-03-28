export type MeasurementStatus =
  | "idle"
  | "initializing"
  | "calibrating"
  | "measuring"
  | "paused"
  | "error";

export interface VitalReading {
  timestamp: number;
  bpm: number;
  spo2: number;
  hrv: number;
  quality: number;
  trustScore: number;
}

export interface PersonDetection {
  detected: boolean;
  count: number;
  warning: string | null;
}

export interface MotionState {
  stable: boolean;
  magnitude: number;
}

export interface TrustFactors {
  face_detected: boolean;
  single_person: boolean;
  motion_stable: boolean;
  lighting_ok: boolean;
  frame_rate: number;
}

export interface RPPGResult {
  bpm: number | null;
  spo2: number | null;
  hrv: number | null;
  signal_quality: number;
  trust_score: number;
  progress: number;
  frames: number;
  peak_hz: number | null;
  signal: number[];
}

// Extend Window for MediaPipe globals loaded via CDN
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}
