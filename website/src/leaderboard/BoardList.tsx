import { Button, Card } from "@posthog/quill";
import { useState, type ReactNode } from "react";
import type { Leaderboard, LeaderboardRow } from "../leaderboardFixtures";
import { BoardLine } from "./BoardLine";
import { WholeBoard } from "./WholeBoard";

export function BoardList({ board, after }: { board: Leaderboard; after?: ReactNode }) {
  const [whole, setWhole] = useState(false);
  const below = board.window.filter((position) => position > 3);
  const longer = board.rows.length > board.window.length;
  if (below.length === 0 && after === undefined && !longer) return null;
  return (
    <Card size="sm" className="gap-0 overflow-hidden py-0">
      <div aria-hidden="true" className="flex items-center justify-between px-3 py-2">
        <span className="hud-label">No. · member</span>
        <span className="hud-label">Kudos given</span>
      </div>
      {whole ? <WholeBoard rows={board.rows} /> : <WindowLines rows={board.rows} below={below} />}
      {after}
      {longer && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <span className="hud-label tabular-nums">{whole ? `No. 1–${board.rows.length} of ${board.rows.length}` : shownRange(below.length > 0 ? below : board.window, board.rows.length)}</span>
          <Button variant="outline" size="sm" onClick={() => setWhole(!whole)}>
            {whole ? returnWords(board) : "Show the whole board"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function shownRange(positions: number[], total: number) {
  return `No. ${positions[0]}–${positions.at(-1)} of ${total}`;
}

function returnWords({ standing }: Leaderboard) {
  return standing.kind === "ranked" ? "Back to my spot" : "Show fewer";
}

function WindowLines({ rows, below }: { rows: LeaderboardRow[]; below: number[] }) {
  if (below.length === 0) return null;
  const shown = [3, ...below];
  return (
    <ol aria-label="No. · member, kudos given" className="flex flex-col">
      {below.flatMap((position, i) => {
        const line = <BoardLine key={position} row={rows[position - 1]!} />;
        return position - shown[i]! > 1 ? [<GapLine key={`gap-${position}`} />, line] : [line];
      })}
    </ol>
  );
}

function GapLine() {
  return <li className="border-t px-3 py-1 text-center text-muted-foreground">…</li>;
}
