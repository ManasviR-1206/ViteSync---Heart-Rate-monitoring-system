import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { VitalReading } from "../types";

// ── Live signal waveform
interface WaveformProps {
  signal: number[];
  ready: boolean;
}

export const LiveWaveform: React.FC<WaveformProps> = ({ signal, ready }) => {
  const data = useMemo(
    () => signal.map((v, i) => ({ i, v })),
    [signal]
  );

  const color = ready ? "#00e5b0" : "#ffb800";

  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#sigGrad)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ── BPM history chart
interface HistoryChartProps {
  history: VitalReading[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#0a1220",
      border: "1px solid #1e3048",
      borderRadius: 8,
      padding: "8px 12px",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
    }}>
      <div style={{ color: "#00e5b0" }}>{d.bpm} BPM</div>
      <div style={{ color: "#4488ff" }}>SpO₂ {d.spo2}%</div>
      <div style={{ color: "#666", marginTop: 2 }}>{new Date(d.timestamp).toLocaleTimeString()}</div>
    </div>
  );
};

export const HistoryChart: React.FC<HistoryChartProps> = ({ history }) => {
  const data = history.map(h => ({
    ...h,
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }));

  const avg = Math.round(data.reduce((a,b)=>a+b.bpm,0) / data.length);

  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={avg}
          stroke="rgba(255,255,255,0.1)"
          strokeDasharray="4 4"
        />
        <Line
          type="monotone"
          dataKey="bpm"
          stroke="#00e5b0"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          style={{ filter: "drop-shadow(0 0 4px #00e5b0)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
