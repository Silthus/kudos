import { IconCrown } from "@posthog/icons";
import type { Leaderboard, LeaderboardRow } from "../shell";
import { BoardFace, RankWords, YouLabel } from "./BoardFace";

type Step = "first" | "second" | "third";

const pedestalHeight: Record<Step, string> = { first: "h-20 sm:h-28", second: "h-14 sm:h-20", third: "h-10 sm:h-14" };

export function Podium({ board: { rows, window } }: { board: Leaderboard }) {
  const [first, second, third] = window.filter((position) => position <= 3).map((position) => rows[position - 1]!);
  const leftToRight = [second, first, third].filter((row) => row !== undefined);
  return (
    <ul aria-label="Top three" className={`mx-auto grid w-full max-w-2xl items-end gap-2 border-b px-1 sm:gap-4 sm:px-3 ${columns[leftToRight.length]}`}>
      {leftToRight.map((row) => (
        <Spot key={row.position} row={row} />
      ))}
    </ul>
  );
}

const columns: Record<number, string> = { 1: "max-w-56 grid-cols-1", 2: "max-w-md grid-cols-2", 3: "grid-cols-3" };

function stepOf(rank: number): Step {
  if (rank === 1) return "first";
  return rank === 2 ? "second" : "third";
}

function Spot({ row }: { row: LeaderboardRow }) {
  const step = stepOf(row.rank);
  const leads = step === "first";
  return (
    <li className="flex min-w-0 flex-col items-center">
      <RankWords row={row} />
      {leads ? <IconCrown data-crown aria-hidden="true" className="mb-1 size-5 sm:size-6" /> : <span aria-hidden="true" className="mb-1 h-5 sm:h-6" />}
      <BoardFace row={row} className={leads ? "size-16 sm:size-20 text-base" : "size-12 sm:size-16 text-sm"} />
      <span className="mt-2 flex w-full min-w-0 items-center justify-center gap-1.5">
        <span title={row.name} className="truncate text-sm font-semibold">
          {row.name}
        </span>
        {row.you && <YouLabel />}
      </span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className={`font-bold tabular-nums leading-none ${leads ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{row.kudos}</span>{" "}
        <span className="text-[11px] text-muted-foreground">kudos</span>
      </span>
      <span
        data-pedestal={step}
        aria-hidden="true"
        className={`mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-1.5 ${pedestalHeight[step]} ${leads ? "bg-gradient-to-b from-foreground/15 to-foreground/[0.03]" : "bg-gradient-to-b from-muted to-transparent"}`}
      >
        <span className={`text-xl font-bold leading-none tabular-nums sm:text-3xl ${leads ? "text-foreground" : "text-muted-foreground"}`}>
          {row.rank}
          {row.tied && <span className="text-sm">=</span>}
        </span>
      </span>
    </li>
  );
}
