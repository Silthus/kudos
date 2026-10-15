import { IconCrown } from "@posthog/icons";
import type { ReactNode } from "react";
import { BoardFace, RankWords, YouLabel } from "./BoardFace";
import type { PeopleBoard } from "./boards";
import { Climbed } from "./Climbed";

type Step = "first" | "second" | "third";

export type PodiumSpot = { key: string; rank: number; tied: boolean; name: string; mine: string | undefined; face: (leads: boolean) => ReactNode; value: string; unit: string; detail?: string; climbed: number | null };

const pedestalHeight: Record<Step, string> = { first: "h-20 sm:h-28", second: "h-14 sm:h-20", third: "h-10 sm:h-14" };

export function Podium({ spots }: { spots: PodiumSpot[] }) {
  const [first, second, third] = spots;
  const leftToRight = [second, first, third].filter((spot) => spot !== undefined);
  return (
    <ul aria-label="Top three" className={`mx-auto grid w-full max-w-2xl items-end gap-2 border-b px-1 sm:gap-4 sm:px-3 ${columns[leftToRight.length]}`}>
      {leftToRight.map((spot) => (
        <Spot key={spot.key} spot={spot} />
      ))}
    </ul>
  );
}

export function PeoplePodium({ board: { rows, window } }: { board: PeopleBoard }) {
  const spots = window
    .filter((position) => position <= 3)
    .map((position) => rows[position - 1]!)
    .map(
      (row): PodiumSpot => ({
        key: String(row.position),
        rank: row.rank,
        tied: row.tied,
        name: row.name,
        mine: row.you ? "You" : undefined,
        face: (leads) => <BoardFace row={row} className={leads ? "size-16 sm:size-20 text-base" : "size-12 sm:size-16 text-sm"} />,
        value: String(row.kudos),
        unit: "kudos",
        climbed: row.climbed,
      }),
    );
  return <Podium spots={spots} />;
}

const columns: Record<number, string> = { 1: "max-w-56 grid-cols-1", 2: "max-w-md grid-cols-2", 3: "grid-cols-3" };

function stepOf(rank: number): Step {
  if (rank === 1) return "first";
  return rank === 2 ? "second" : "third";
}

function Spot({ spot }: { spot: PodiumSpot }) {
  const step = stepOf(spot.rank);
  const leads = step === "first";
  return (
    <li className="flex min-w-0 flex-col items-center">
      <RankWords row={spot} />
      {leads ? <IconCrown data-crown aria-hidden="true" className="mb-1 size-5 sm:size-6" /> : <span aria-hidden="true" className="mb-1 h-5 sm:h-6" />}
      {spot.face(leads)}
      <span className="mt-2 flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <span title={spot.name} className="truncate text-sm font-semibold">
          {spot.name}
        </span>
        {spot.mine !== undefined && <YouLabel>{spot.mine}</YouLabel>}
      </span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className={`font-bold tabular-nums leading-none ${leads ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{spot.value}</span>{" "}
        <span className="text-[11px] text-muted-foreground">{spot.unit}</span>
      </span>
      {spot.detail !== undefined && <span className="mt-1 text-center text-[11px] tabular-nums text-muted-foreground">{spot.detail}</span>}
      <Climbed places={spot.climbed} />
      <span
        data-pedestal={step}
        aria-hidden="true"
        className={`mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-1.5 ${pedestalHeight[step]} ${leads ? "bg-gradient-to-b from-foreground/15 to-foreground/[0.03]" : "bg-gradient-to-b from-muted to-transparent"}`}
      >
        <span className={`text-xl font-bold leading-none tabular-nums sm:text-3xl ${leads ? "text-foreground" : "text-muted-foreground"}`}>
          {spot.rank}
          {spot.tied && <span className="text-sm">=</span>}
        </span>
      </span>
    </li>
  );
}
