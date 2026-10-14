import { useId } from "react";
import type { TierId } from "../shell";
import { glintOf, metalOf } from "./metal";

const sparkles: ReadonlySet<TierId> = new Set(["gold", "diamond"]);

const points = 28;

const outline = Array.from({ length: points * 2 }, (_, i) => {
  const radius = i % 2 === 0 ? 50 : 46;
  const angle = (Math.PI * i) / points - Math.PI / 2;
  return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

export function Rosette({ tier }: { tier: TierId | null }) {
  return (
    <svg data-rosette={tier ?? "none"} viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
      {tier === null ? <Unearned /> : <Earned tier={tier} />}
      {tier !== null && sparkles.has(tier) && <Sparkle tier={tier} />}
    </svg>
  );
}

function Unearned() {
  return (
    <>
      <polygon points={outline} fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth="0.75" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="38" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="3 3" />
    </>
  );
}

function Earned({ tier }: { tier: TierId }) {
  const sheen = useId();
  const metal = metalOf(tier);
  return (
    <>
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: glintOf(tier) }} />
          <stop offset="0.55" style={{ stopColor: `oklch(from ${metal} 0.82 calc(c * 1.4) h)` }} />
          <stop offset="1" style={{ stopColor: metal }} />
        </linearGradient>
      </defs>
      <polygon points={outline} fill={`url(#${sheen})`} stroke={metal} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="38" fill="var(--card)" stroke={metal} strokeWidth="2.5" />
    </>
  );
}

function Sparkle({ tier }: { tier: TierId }) {
  return <path data-sparkle="" d="M88 -3.5 90.4 6.6 100.5 9 90.4 11.4 88 21.5 85.6 11.4 75.5 9 85.6 6.6Z" fill={glintOf(tier)} stroke={metalOf(tier)} strokeWidth="2" strokeLinejoin="round" />;
}
