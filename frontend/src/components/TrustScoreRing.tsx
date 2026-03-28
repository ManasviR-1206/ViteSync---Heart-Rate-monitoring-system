import React from "react";

interface Props {
  score: number;   // 0-100
  size?: number;
}

export const TrustScoreRing: React.FC<Props> = ({ score, size = 120 }) => {
  const r      = (size - 18) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const circum = 2 * Math.PI * r;
  const dash   = (score / 100) * circum;

  const color =
    score >= 70 ? "#00e5b0" :
    score >= 40 ? "#ffb800" : "#ff4455";

  const label =
    score >= 70 ? "HIGH" :
    score >= 40 ? "MED"  : "LOW";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={9}
      />
      {/* Glow ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeOpacity={0.12}
      />
      {/* Progress ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circum}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 0.6s ease" }}
      />
      {/* Score text */}
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        fill={color}
        fontSize={score >= 100 ? 22 : 26}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      >
        {score}
      </text>
      <text
        x={cx} y={cy + 14}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing={2}
      >
        {label}
      </text>
      <text
        x={cx} y={cy + 26}
        textAnchor="middle"
        fill="rgba(255,255,255,0.25)"
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing={1.5}
      >
        TRUST
      </text>
    </svg>
  );
};
