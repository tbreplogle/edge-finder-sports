import React from 'react';

interface ConfidenceMeterProps {
  value: number;     // 1–10
  size?: number;     // diameter in px, defaults to 48
  strokeWidth?: number; // gauge thickness, defaults to 4
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  value,
  size = 48,
  strokeWidth = 4,
}) => {
  // percent of circle (0–100)
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        stroke="var(--muted-foreground)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Foreground arc */}
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        stroke="var(--edge-secondary)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      {/* Text label */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="text-xs font-medium"
        fill="var(--foreground)"
      >
        {value.toFixed(1)}
      </text>
    </svg>
  );
};
