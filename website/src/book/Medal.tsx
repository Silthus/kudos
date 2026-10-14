import type { TierId } from "../shell";
import { glintOf, metalOf } from "./metal";

const pipsOf: Record<TierId, number> = { bronze: 1, silver: 2, gold: 3, diamond: 4 };

const sparkles: ReadonlySet<TierId> = new Set(["gold", "diamond"]);

const pipSpacing = 3.6;

export function Medal({ tier, earned }: { tier: TierId; earned: boolean }) {
  const pips = pipsOf[tier];
  const metal = metalOf(tier);
  const ink = earned ? { fill: "var(--card)", stroke: "none" } : { fill: "none", stroke: "var(--muted-foreground)" };
  return (
    <svg data-medal={earned ? "earned" : "outline"} width={28} height={28} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 overflow-visible">
      <circle cx="12" cy="12" r="10" fill={earned ? metal : "none"} stroke={earned ? metal : "var(--muted-foreground)"} strokeWidth="1.5" strokeDasharray={earned ? undefined : "2.5 2"} />
      {Array.from({ length: pips }, (_, pip) => (
        <circle key={pip} data-pip="" cx={12 + (pip - (pips - 1) / 2) * pipSpacing} cy="12" r="1.3" strokeWidth="1" {...ink} />
      ))}
      {sparkles.has(tier) && <path data-sparkle="" d="M20 0.5 21.2 3.8 24.5 5 21.2 6.2 20 9.5 18.8 6.2 15.5 5 18.8 3.8Z" fill={earned ? glintOf(tier) : "var(--card)"} stroke={earned ? metal : "var(--muted-foreground)"} strokeWidth="1" strokeLinejoin="round" />}
    </svg>
  );
}
