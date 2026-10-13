import { IconTarget } from "@posthog/icons";
import { Button } from "@posthog/quill";
import type { LeaderboardRow } from "../leaderboardFixtures";
import { BoardFace, RankWords, YouLabel } from "./BoardFace";

export function BoardLine({ row, focusable = false }: { row: LeaderboardRow; focusable?: boolean }) {
  return (
    <li
      data-you={row.you || undefined}
      tabIndex={focusable && row.you ? -1 : undefined}
      className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${row.you ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}
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

export function JumpToMe({ onJump }: { onJump: () => void }) {
  return (
    <Button variant="outline" size="sm" className="mr-3 shrink-0" onClick={onJump}>
      <IconTarget aria-hidden="true" className="size-3.5" />
      Jump to me
    </Button>
  );
}
