import { Card } from "@posthog/quill";
import type { ReactNode } from "react";
import type { Leaderboard, LeaderboardRow } from "../leaderboardFixtures";
import { BoardFace, RankWords, YouLabel } from "./BoardFace";

export function BoardList({ board, after }: { board: Leaderboard; after?: ReactNode }) {
  const below = board.window.filter((position) => position > 3);
  if (below.length === 0 && after === undefined) return null;
  return (
    <Card size="sm" className="gap-0 overflow-hidden py-0">
      <div aria-hidden="true" className="flex items-center justify-between px-3 py-2">
        <span className="hud-label">No. · member</span>
        <span className="hud-label">Kudos given</span>
      </div>
      {below.length > 0 && (
        <ol aria-label="No. · member, kudos given" className="flex flex-col">
          {linesOf(board.rows, [3, ...below])}
        </ol>
      )}
      {after}
    </Card>
  );
}

function linesOf(rows: LeaderboardRow[], shown: number[]) {
  return shown.slice(1).flatMap((position, i) => {
    const line = <BoardLine key={position} row={rows[position - 1]!} />;
    return position - shown[i]! > 1 ? [<GapLine key={`gap-${position}`} />, line] : [line];
  });
}

export function BoardLine({ row }: { row: LeaderboardRow }) {
  return (
    <li
      data-you={row.you || undefined}
      className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-2.5 ${row.you ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}
    >
      <RankWords row={row} />
      <span aria-hidden="true" className="flex items-baseline gap-0.5 text-muted-foreground">
        <span className="text-lg font-semibold tabular-nums">{row.rank}</span>
        {row.tied && <span className="text-xs">=</span>}
      </span>
      <span className="flex min-w-0 items-center gap-2.5 text-sm">
        <BoardFace row={row} className="size-8" />
        <span className="truncate font-medium">{row.name}</span>
        {row.you && <YouLabel />}
      </span>
      <span className="text-right text-lg font-semibold tabular-nums">{row.kudos}</span>
    </li>
  );
}

function GapLine() {
  return <li className="border-t px-3 py-1 text-center text-muted-foreground">…</li>;
}
