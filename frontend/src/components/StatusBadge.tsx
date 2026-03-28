import React from "react";
import type { MeasurementStatus } from "../types";

const STATUS_CONFIG: Record<MeasurementStatus, { label: string; color: string; dot: boolean }> = {
  idle:         { label: "IDLE",          color: "#445566", dot: false },
  initializing: { label: "INITIALIZING",  color: "#ffb800", dot: true  },
  calibrating:  { label: "CALIBRATING",   color: "#ffb800", dot: true  },
  measuring:    { label: "MEASURING",     color: "#00e5b0", dot: true  },
  paused:       { label: "PAUSED",        color: "#445566", dot: false },
  error:        { label: "ERROR",         color: "#ff4455", dot: false },
};

interface Props {
  status: MeasurementStatus;
  connected: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, connected }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Server connection */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, letterSpacing: "0.15em",
        color: connected ? "#00e5b0" : "#445566",
        padding: "3px 8px",
        border: `1px solid ${connected ? "rgba(0,229,176,0.3)" : "rgba(68,85,102,0.3)"}`,
        borderRadius: 4,
      }}>
        <span style={{ fontSize: 7 }}>●</span>
        {connected ? "BACKEND" : "OFFLINE"}
      </div>

      {/* Status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, letterSpacing: "0.15em",
        color: cfg.color,
        padding: "3px 8px",
        border: `1px solid ${cfg.color}44`,
        borderRadius: 4,
        background: `${cfg.color}0d`,
      }}>
        {cfg.dot && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: cfg.color,
            boxShadow: `0 0 6px ${cfg.color}`,
            animation: "pulseDot 1.2s ease-in-out infinite",
            display: "inline-block",
          }} />
        )}
        {cfg.label}
      </div>
    </div>
  );
};
