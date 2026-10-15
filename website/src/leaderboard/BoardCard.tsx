import { IconGlobe } from "@posthog/icons";
import type { Leaderboard } from "../shell";

export function BoardCard({ board }: { board: Leaderboard }) {
  return (
    <section aria-labelledby="everyone-board-title" className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <IconGlobe className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <h2 id="everyone-board-title" className="text-lg font-semibold leading-tight">
          Everyone
        </h2>
        <p className="text-xs text-muted-foreground">The whole company on one board</p>
      </div>
      <p className="ml-auto text-sm font-medium tabular-nums">{standingIn(board)}</p>
    </section>
  );
}

function standingIn({ standing, rows }: Leaderboard) {
  switch (standing.kind) {
    case "ranked":
      return rows[standing.position - 1]?.tied ? `You're tied at #${standing.rank}` : `You're #${standing.rank}`;
    case "not-ranked":
      return "Not ranked yet";
    case "left":
      return "Off the board";
  }
}
