import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrustScoreRing } from "./components/TrustScoreRing";
import { LiveWaveform, HistoryChart } from "./components/SignalChart";
import { StatusBadge } from "./components/StatusBadge";
import { useRPPG } from "./hooks/useRPPG";

const App: React.FC = () => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [tick,    setTick]    = useState(0);
  const [clock,   setClock]   = useState("");

  const {
    bpm, spo2, hrv, trustScore, signalQuality, progress,
    status, frameRate, lightingOk, connected,
    personDetection, motionState, history, liveSignal,
    start, stop, reset,
  } = useRPPG(videoRef, canvasRef);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-US", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  // Heartbeat animation tick
  useEffect(() => {
    if (!bpm || status !== "measuring") return;
    const t = setInterval(() => setTick(n => n+1), 60000/bpm);
    return () => clearInterval(t);
  }, [bpm, status]);

  const handleStart = async () => { setStarted(true); await start(); };
  const handleStop  = () => stop();
  const handleReset = () => { reset(); };

  // ── BPM colors
  const bpmColor =
    !bpm ? "#334455" :
    bpm < 60  ? "#4488ff" :
    bpm > 130 ? "#ff4455" :
    bpm > 100 ? "#ffb800" : "#00e5b0";

  const bpmZone =
    !bpm ? "—" :
    bpm < 60  ? "RESTING" :
    bpm < 80  ? "NORMAL"  :
    bpm < 100 ? "ELEVATED" : "HIGH";

  // ── Trust factors
  const factors = [
    { label: "Face Detected",  ok: personDetection.detected },
    { label: "Single Person",  ok: personDetection.count === 1 },
    { label: "Motion Stable",  ok: motionState.stable },
    { label: "Good Lighting",  ok: lightingOk },
    { label: "Signal Quality", ok: signalQuality > 50 },
    { label: "Buffer Ready",   ok: status === "measuring" },
  ];

  // ── Session stats
  const sessionMin = history.length ? Math.min(...history.map(h=>h.bpm)) : null;
  const sessionMax = history.length ? Math.max(...history.map(h=>h.bpm)) : null;
  const sessionAvg = history.length ? Math.round(history.reduce((a,h)=>a+h.bpm,0)/history.length) : null;

  return (
    <div style={S.root}>
      {/* Background effects */}
      <div style={S.bgGrid} />
      <div style={S.bgGlowTR} />
      <div style={S.bgGlowBL} />

      {/* ── HEADER */}
      <header style={S.header}>
        <div style={S.logo}>
          <motion.span
            animate={{ scale: [1, 1.25, 1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: bpm ? 60/bpm : 1.2, ease: "easeInOut" }}
            style={{ fontSize: 20, color: "#00e5b0", textShadow: "0 0 14px #00e5b0", lineHeight: 1 }}
          >❤</motion.span>
          <span style={S.logoText}>VITAL<span style={{ color:"#00e5b0" }}>SYNC</span></span>
          <span style={S.logoVersion}>v3</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <StatusBadge status={status} connected={connected} />
          <span style={S.fps}>{frameRate > 0 ? `${frameRate} FPS` : "--"}</span>
          <span style={S.clock}>{clock}</span>
        </div>
      </header>

      {/* ── PERSON WARNING BANNER */}
      <AnimatePresence>
        {personDetection.warning && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            style={S.warningBanner}
          >
            <span>⚠</span>
            <span>{personDetection.warning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN GRID */}
      <main style={S.main}>

        {/* ── LEFT: Camera */}
        <div style={S.leftPanel}>
          <div style={S.card}>
            {/* Card header */}
            <div style={S.cardHeader}>
              <span style={S.cardLabel}>CAMERA FEED</span>
              <div style={{
                ...S.personBadge,
                borderColor: personDetection.count===1 ? "#00e5b0" : personDetection.count>1 ? "#ff4455" : "#334455",
                color:       personDetection.count===1 ? "#00e5b0" : personDetection.count>1 ? "#ff4455" : "#334455",
                background:  personDetection.count===1 ? "rgba(0,229,176,0.08)" : personDetection.count>1 ? "rgba(255,68,85,0.08)" : "transparent",
              }}>
                {personDetection.count===0 ? "NO FACE" : personDetection.count===1 ? "✓ 1 PERSON" : `⚠ ${personDetection.count} FACES`}
              </div>
            </div>

            {/* Canvas */}
            <div style={S.cameraWrap}>
              <video ref={videoRef} autoPlay muted playsInline style={{ display:"none" }} />
              <canvas ref={canvasRef} width={640} height={480} style={S.canvas} />

              {/* Idle overlay */}
              <AnimatePresence>
                {!started && (
                  <motion.div
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    style={S.cameraOverlay}
                  >
                    <motion.div
                      animate={{ scale:[1,1.08,1], textShadow:["0 0 20px #00e5b0","0 0 40px #00e5b0","0 0 20px #00e5b0"] }}
                      transition={{ repeat:Infinity, duration:2 }}
                      style={{ fontSize:52, lineHeight:1 }}
                    >❤</motion.div>
                    <p style={S.startTitle}>VitalSync rPPG</p>
                    <p style={S.startSub}>Contactless heart rate via camera · No sensors needed</p>
                    <motion.button
                      whileHover={{ scale:1.04, boxShadow:"0 0 40px rgba(0,229,176,0.4)" }}
                      whileTap={{ scale:0.97 }}
                      style={S.startBtn}
                      onClick={handleStart}
                    >
                      START MEASURING
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Calibration bar */}
              {started && status === "calibrating" && (
                <div style={S.calBar}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffb800", letterSpacing:"0.1em" }}>
                      CALIBRATING
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#ffb800" }}>
                      {Math.round(progress*100)}%
                    </span>
                  </div>
                  <div style={S.progTrack}>
                    <motion.div
                      style={S.progFill}
                      animate={{ width: `${progress*100}%`, background:"#ffb800" }}
                      transition={{ duration:0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer metrics */}
            <div style={S.camFooter}>
              {[
                { label:"MOTION",    val: motionState.stable ? "● STABLE" : "⚡ MOVING", ok: motionState.stable },
                { label:"LIGHTING",  val: lightingOk ? "● GOOD" : "⚠ ADJUST",           ok: lightingOk },
              ].map(({label,val,ok}) => (
                <div key={label} style={S.footerItem}>
                  <span style={S.footerLabel}>{label}</span>
                  <span style={{ ...S.footerVal, color: ok ? "#00e5b0" : "#ffb800" }}>{val}</span>
                </div>
              ))}
              <div style={{ ...S.footerItem, flex:2 }}>
                <span style={S.footerLabel}>SIGNAL QUALITY</span>
                <div style={S.progTrack}>
                  <motion.div
                    style={S.progFill}
                    animate={{ width:`${signalQuality}%` }}
                    transition={{ duration:0.5 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live waveform */}
          <div style={{ ...S.card, marginTop:12 }}>
            <div style={S.cardHeader}>
              <span style={S.cardLabel}>GREEN CHANNEL · LIVE SIGNAL</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#334455" }}>
                0.7–4.0 Hz BANDPASS
              </span>
            </div>
            <div style={{ padding:"8px 0 4px" }}>
              <LiveWaveform signal={liveSignal} ready={status==="measuring"} />
            </div>
          </div>
        </div>

        {/* ── RIGHT: Vitals */}
        <div style={S.rightPanel}>

          {/* Trust score card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardLabel}>MEASUREMENT TRUST SCORE</span>
              <span style={{
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700,
                color: trustScore>=70?"#00e5b0":trustScore>=40?"#ffb800":"#ff4455",
                letterSpacing:"0.1em",
              }}>
                {trustScore>=70?"HIGH CONFIDENCE":trustScore>=40?"MODERATE":"LOW"}
              </span>
            </div>
            <div style={{ display:"flex", gap:16, padding:"14px 16px", alignItems:"center" }}>
              <TrustScoreRing score={trustScore} size={116} />
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:7 }}>
                {factors.map(({label,ok}) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color: ok?"#00e5b0":"#ff4455", fontSize:12, width:14, textAlign:"center" }}>
                      {ok ? "✓" : "✗"}
                    </span>
                    <span style={{
                      fontFamily:"'Outfit',sans-serif", fontSize:12,
                      color: ok?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.28)",
                    }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BPM card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardLabel}>HEART RATE</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:bpmColor, letterSpacing:"0.1em" }}>
                {bpmZone}
              </span>
            </div>
            <div style={{ padding:"10px 18px 14px", display:"flex", alignItems:"center", gap:0 }}>
              <div style={{ flex:1 }}>
                <motion.div
                  key={tick}
                  animate={{ scale:[1.08,1] }}
                  transition={{ duration:0.3 }}
                  style={{
                    fontFamily:"'Outfit',sans-serif",
                    fontWeight:800, fontSize:72, lineHeight:1,
                    color:bpmColor,
                    textShadow:`0 0 30px ${bpmColor}88`,
                    letterSpacing:"-2px",
                    fontVariantNumeric:"tabular-nums",
                  }}
                >
                  {bpm ?? "--"}
                </motion.div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"rgba(255,255,255,0.25)", letterSpacing:"0.2em", marginTop:2 }}>
                  BEATS / MIN
                </div>
              </div>
              {/* Heart icon */}
              <motion.div
                animate={{ scale: [1,1.22,1,1.1,1] }}
                transition={{ repeat:Infinity, duration: bpm ? 60/bpm : 1, ease:"easeInOut" }}
                style={{ fontSize:32, color:bpm?"#ff4455":"#334455", filter:bpm?"drop-shadow(0 0 8px #ff4455)":"none" }}
              >❤</motion.div>
            </div>

            {/* BPM zone bar */}
            <div style={{ padding:"0 18px 14px", display:"flex", gap:4 }}>
              {[
                { label:"RESTING", range:"<60",  color:"#4488ff", active: !!bpm && bpm<60 },
                { label:"NORMAL",  range:"60–80", color:"#00e5b0", active: !!bpm && bpm>=60 && bpm<80 },
                { label:"ELEVATED",range:"80–100",color:"#ffb800", active: !!bpm && bpm>=80 && bpm<100 },
                { label:"HIGH",    range:">100",  color:"#ff4455", active: !!bpm && bpm>=100 },
              ].map(z => (
                <div key={z.label} style={{
                  flex:1, padding:"4px 6px", borderRadius:4,
                  border:`1px solid ${z.active ? z.color+"66" : "rgba(255,255,255,0.04)"}`,
                  background: z.active ? `${z.color}14` : "transparent",
                  textAlign:"center",
                }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color: z.active?z.color:"#334455", letterSpacing:"0.1em" }}>{z.label}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#334455" }}>{z.range}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SpO2 + HRV */}
          <div style={{ display:"flex", gap:12 }}>
            {[
              {
                label:"SpO₂",
                value: status==="measuring" ? `${spo2}` : "--",
                unit:"%",
                sub: spo2>=95?"Normal":"Low",
                color: spo2>=95?"#4488ff":"#ff4455",
              },
              {
                label:"HRV (RMSSD)",
                value: status==="measuring" && hrv>0 ? `${hrv}` : "--",
                unit:"ms",
                sub: hrv>50?"Excellent":hrv>30?"Good":hrv>0?"Low":"—",
                color:"#a855f7",
              },
            ].map(m => (
              <div key={m.label} style={{ ...S.card, flex:1 }}>
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.2em", color:"rgba(255,255,255,0.3)", marginBottom:8 }}>
                    {m.label}
                  </div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                    <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:36, color:m.color }}>
                      {m.value}
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"rgba(255,255,255,0.25)" }}>
                      {m.unit}
                    </span>
                  </div>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:11, color:`${m.color}99`, marginTop:2 }}>
                    {m.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:10 }}>
            {!started ? (
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} style={S.btnPrimary} onClick={handleStart}>
                ▶ START
              </motion.button>
            ) : (
              <>
                <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} style={S.btnSecondary} onClick={handleStop}>
                  ⏸ PAUSE
                </motion.button>
                <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} style={S.btnGhost} onClick={handleReset}>
                  ↺ RESET
                </motion.button>
              </>
            )}
          </div>

        </div>
      </main>

      {/* ── BPM HISTORY */}
      <AnimatePresence>
        {history.length > 3 && (
          <motion.section
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            style={S.historySection}
          >
            <div style={S.card}>
              <div style={S.cardHeader}>
                <span style={S.cardLabel}>HEART RATE HISTORY</span>
                <div style={{ display:"flex", gap:20 }}>
                  {[
                    { k:"MIN", v:sessionMin },
                    { k:"AVG", v:sessionAvg },
                    { k:"MAX", v:sessionMax },
                  ].map(({k,v}) => (
                    <span key={k} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#334455", letterSpacing:"0.1em" }}>
                      {k} <span style={{ color:"#00e5b088" }}>{v ?? "--"}</span>
                    </span>
                  ))}
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#223344" }}>
                    {history.length} READINGS
                  </span>
                </div>
              </div>
              <div style={{ padding:"8px 0 6px" }}>
                <HistoryChart history={history} />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulseDot {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.35; transform:scale(.6); }
        }
        * { box-sizing:border-box; margin:0; padding:0; }
        html,body { background:#060c18; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#06090f; }
        ::-webkit-scrollbar-thumb { background:#1a2a3a; border-radius:2px; }
        button { cursor:pointer; }
      `}</style>
    </div>
  );
};

// ── Styles

const CARD_BG      = "rgba(255,255,255,0.025)";
const CARD_BORDER  = "rgba(255,255,255,0.07)";
const MONO         = "'JetBrains Mono', monospace";
const SANS         = "'Outfit', sans-serif";

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight:"100vh", background:"#060c18", color:"#fff",
    fontFamily:SANS, position:"relative", overflowX:"hidden",
  },
  bgGrid: {
    position:"fixed", inset:0, pointerEvents:"none",
    backgroundImage:`
      linear-gradient(rgba(0,229,176,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,176,0.025) 1px, transparent 1px)
    `,
    backgroundSize:"44px 44px",
  },
  bgGlowTR: {
    position:"fixed", top:-200, right:-200, width:600, height:600,
    borderRadius:"50%", pointerEvents:"none",
    background:"radial-gradient(circle, rgba(0,229,176,0.06) 0%, transparent 65%)",
  },
  bgGlowBL: {
    position:"fixed", bottom:-200, left:-200, width:500, height:500,
    borderRadius:"50%", pointerEvents:"none",
    background:"radial-gradient(circle, rgba(68,136,255,0.05) 0%, transparent 65%)",
  },
  header: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"14px 28px",
    borderBottom:"1px solid rgba(255,255,255,0.06)",
    background:"rgba(6,12,24,0.92)", backdropFilter:"blur(20px)",
    position:"sticky", top:0, zIndex:100,
  },
  logo: { display:"flex", alignItems:"center", gap:10 },
  logoText: { fontFamily:SANS, fontWeight:800, fontSize:18, letterSpacing:"0.06em" },
  logoVersion: { fontFamily:MONO, fontSize:10, color:"#334455", letterSpacing:"0.1em", marginLeft:2 },
  fps:  { fontFamily:MONO, fontSize:11, color:"#2a3f52", letterSpacing:"0.05em" },
  clock:{ fontFamily:MONO, fontSize:12, color:"#2a3f52" },

  warningBanner: {
    display:"flex", alignItems:"center", gap:10,
    padding:"10px 28px",
    background:"rgba(255,68,85,0.1)",
    borderBottom:"1px solid rgba(255,68,85,0.25)",
    color:"#ff7788", fontFamily:MONO, fontSize:12, letterSpacing:"0.05em",
  },
  main: {
    display:"flex", gap:18, padding:"18px 28px",
    maxWidth:1180, margin:"0 auto",
  },
  leftPanel:  { flex:"0 0 auto", width:490, display:"flex", flexDirection:"column" },
  rightPanel: { flex:1, display:"flex", flexDirection:"column", gap:14 },

  card: {
    background:CARD_BG,
    border:`1px solid ${CARD_BORDER}`,
    borderRadius:14, overflow:"hidden",
  },
  cardHeader: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"11px 15px",
    borderBottom:"1px solid rgba(255,255,255,0.04)",
  },
  cardLabel: { fontFamily:MONO, fontSize:9, letterSpacing:"0.22em", color:"rgba(255,255,255,0.3)", fontWeight:700 },

  personBadge: {
    fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:"0.1em",
    padding:"3px 8px", border:"1px solid", borderRadius:4,
  },

  cameraWrap: { position:"relative", background:"#030710", aspectRatio:"4/3" },
  canvas: { width:"100%", height:"100%", display:"block", objectFit:"cover" },

  cameraOverlay: {
    position:"absolute", inset:0,
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    gap:12, background:"rgba(3,7,16,0.93)", backdropFilter:"blur(4px)",
  },
  startTitle: { fontFamily:SANS, fontWeight:800, fontSize:22, color:"#fff" },
  startSub:   { fontFamily:SANS, fontSize:13, color:"rgba(255,255,255,0.35)", textAlign:"center", maxWidth:300 },
  startBtn: {
    marginTop:8, padding:"13px 32px",
    background:"linear-gradient(135deg, #00e5b0, #00aaff)",
    border:"none", borderRadius:8,
    color:"#040b16", fontFamily:SANS, fontWeight:800,
    fontSize:13, letterSpacing:"0.12em",
    boxShadow:"0 0 30px rgba(0,229,176,0.3)",
  },

  calBar: {
    position:"absolute", bottom:0, left:0, right:0,
    padding:"10px 16px", background:"rgba(3,7,16,0.88)", backdropFilter:"blur(4px)",
  },
  progTrack: { height:3, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden", flex:1 },
  progFill:  { height:"100%", background:"linear-gradient(90deg,#00e5b0,#00aaff)", borderRadius:2 },

  camFooter: { display:"flex", borderTop:"1px solid rgba(255,255,255,0.04)" },
  footerItem: {
    flex:1, padding:"9px 14px", display:"flex", flexDirection:"column", gap:5,
    borderRight:"1px solid rgba(255,255,255,0.03)",
  },
  footerLabel:{ fontFamily:MONO, fontSize:8, letterSpacing:"0.22em", color:"rgba(255,255,255,0.2)" },
  footerVal:  { fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:"0.05em" },

  historySection: { padding:"0 28px 28px", maxWidth:1180, margin:"0 auto", width:"100%" },

  btnPrimary: {
    flex:1, padding:"12px 20px",
    background:"linear-gradient(135deg, #00e5b0, #00aaff)",
    border:"none", borderRadius:10,
    color:"#040b16", fontFamily:SANS, fontSize:13, fontWeight:800, letterSpacing:"0.1em",
    boxShadow:"0 0 20px rgba(0,229,176,0.2)",
  },
  btnSecondary: {
    flex:1, padding:"12px 20px",
    background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:10, color:"#fff",
    fontFamily:SANS, fontSize:13, fontWeight:700, letterSpacing:"0.1em",
  },
  btnGhost: {
    padding:"12px 20px",
    background:"transparent",
    border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:10, color:"rgba(255,255,255,0.35)",
    fontFamily:SANS, fontSize:13, fontWeight:700, letterSpacing:"0.1em",
  },
};

export default App;
