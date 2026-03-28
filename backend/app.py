"""
app.py — VitalSync rPPG Backend
================================
Flask + Socket.IO server.
  WS event "signal" → processes buffer → emits "result"
"""

# ── eventlet MUST be monkey-patched FIRST, before any other imports
import eventlet
eventlet.monkey_patch()

from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from rppg_processor import RPPGProcessor
import time

app = Flask(__name__)
app.config["SECRET_KEY"] = "vitalsync-rppg-2024"
CORS(app, origins="*")
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    ping_timeout=20,
    ping_interval=10,
)

# sid → processor
sessions: dict[str, RPPGProcessor] = {}


# ─── REST ────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "sessions": len(sessions),
        "timestamp": time.time(),
    })


# ─── Socket.IO ───────────────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    sid = request.sid
    sessions[sid] = RPPGProcessor()
    emit("server_ready", {"sid": sid, "message": "VitalSync v3 ready"})
    print(f"[+] {sid[:8]} connected  ({len(sessions)} sessions)")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    sessions.pop(sid, None)
    print(f"[-] {sid[:8]} disconnected ({len(sessions)} sessions)")


@socketio.on("signal")
def on_signal(data: dict):
    """
    Receive pre-extracted ROI channel data from frontend.
    data = {
      green_vals: float[],   # per-landmark green means
      red_vals:   float[],   # per-landmark red means
      timestamp:  number,    # ms since epoch
      trust_factors: {
        face_detected, single_person, motion_stable,
        lighting_ok, frame_rate
      }
    }
    """
    sid = request.sid
    proc = sessions.get(sid)
    if proc is None:
        proc = RPPGProcessor()
        sessions[sid] = proc

    try:
        result = proc.push(
            green_vals=data.get("green_vals", [128]),
            red_vals=data.get("red_vals", [128]),
            timestamp=float(data.get("timestamp", time.time() * 1000)),
            trust_factors=data.get("trust_factors", {}),
        )
        emit("result", result)
    except Exception as e:
        print(f"[ERROR] {e}")
        emit("error", {"message": str(e)})


@socketio.on("reset")
def on_reset():
    sid = request.sid
    if sid in sessions:
        sessions[sid].reset()
    emit("reset_done", {})


# ─── Entry ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 54)
    print("  VitalSync rPPG Backend  —  http://localhost:5000")
    print("=" * 54)
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
