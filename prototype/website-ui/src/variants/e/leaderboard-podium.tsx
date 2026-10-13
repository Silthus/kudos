// Variant E leaderboard podium: the top three on neutral stepped pedestals, second, first and third from left to right, with only your face ringed in primary.
import type { ReactNode } from "react";
import { IconCrown } from "@posthog/icons";
import { Tag } from "./hud";

export type Spot = { key: string; rank: number; tie: boolean; mine: boolean; face: (size: number) => ReactNode; name: string; value: ReactNode; unit: string; detail?: string };

const pedestal: Record<number, string> = { 1: "h-20 sm:h-28", 2: "h-14 sm:h-20", 3: "h-10 sm:h-14" };
const stagger: Record<number, number> = { 1: 160, 2: 80, 3: 0 };

export function Podium({ spots }: { spots: Spot[] }) {
  const order = [spots[1], spots[0], spots[2]];
  return (
    <ol className="mx-auto grid w-full max-w-2xl grid-cols-3 items-end gap-2 border-b border-border px-1 sm:gap-4 sm:px-3" aria-label="Top three">
      {order.map((spot, i) => (spot ? <Step key={spot.key} spot={spot} /> : <li key={`empty-${i}`} aria-hidden />))}
    </ol>
  );
}

function Step({ spot }: { spot: Spot }) {
  const step = Math.min(spot.rank, 3);
  const first = step === 1;
  return (
    <li className="hud-rise flex min-w-0 flex-col items-center" style={{ animationDelay: `${stagger[step]}ms` }} aria-label={`Rank ${spot.rank}${spot.tie ? ", tied" : ""}: ${spot.name}`}>
      {first ? <IconCrown className="mb-1 size-5 text-foreground sm:size-6" aria-hidden /> : <span className="mb-1 h-5 sm:h-6" aria-hidden />}
      <span className="hidden sm:block">{spot.face(first ? 88 : 68)}</span>
      <span className="sm:hidden">{spot.face(first ? 60 : 48)}</span>
      <span className="mt-2 flex w-full min-w-0 items-center justify-center gap-1.5">
        <span className="truncate text-sm font-semibold">{spot.name}</span>
        {spot.mine && (
          <span className="hidden sm:inline-flex">
            <Tag variant="info">You</Tag>
          </span>
        )}
      </span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className={`hud-display font-bold tabular-nums leading-none ${first ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{spot.value}</span>
        <span className="text-[11px] text-muted-foreground">{spot.unit}</span>
      </span>
      {spot.detail && <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{spot.detail}</span>}
      <span
        className={`mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-1.5 ${pedestal[step]} ${first ? "bg-gradient-to-b from-foreground/15 to-foreground/[0.03]" : "bg-gradient-to-b from-muted to-transparent"}`}
        aria-hidden
      >
        <span className={`hud-display text-xl font-bold leading-none sm:text-3xl ${first ? "text-foreground" : "text-muted-foreground"}`}>
          {spot.rank}
          {spot.tie && <span className="text-sm">=</span>}
        </span>
      </span>
    </li>
  );
}
