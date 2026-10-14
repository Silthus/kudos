import type { ReactNode } from "react";
import type { Progression } from "./shell";

const trackEdge = 1;

export function levelShare({ xp, levelStartsAt, nextLevelAt }: Progression) {
  return Math.min(100, Math.max(0, ((xp - levelStartsAt) * 100) / (nextLevelAt - levelStartsAt)));
}

export function levelRingName({ level, xpToNextLevel }: Progression) {
  return `Level ${level}, ${xpToNextLevel} XP to level ${level + 1}`;
}

type LevelRingProps = { progression: Progression; size: number; stroke: number; marker?: Record<string, string>; children: ReactNode };

export function LevelRing({ progression, size, stroke, marker, children }: LevelRingProps) {
  const centre = size / 2;
  const radius = (size - stroke) / 2;
  return (
    <span role="img" aria-label={levelRingName(progression)} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} {...marker}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" fill="none">
        <circle cx={centre} cy={centre} r={radius + (stroke - trackEdge) / 2} stroke="var(--muted-foreground)" strokeWidth={trackEdge} />
        <circle cx={centre} cy={centre} r={radius - (stroke - trackEdge) / 2} stroke="var(--muted-foreground)" strokeWidth={trackEdge} />
        <circle
          data-arc
          cx={centre}
          cy={centre}
          r={radius}
          stroke="var(--foreground)"
          strokeWidth={stroke - 2 * trackEdge}
          pathLength={100}
          strokeDasharray={`${levelShare(progression)} 100`}
        />
      </svg>
      {children}
    </span>
  );
}
