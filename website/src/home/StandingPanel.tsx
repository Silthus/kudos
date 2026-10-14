import { AppLink } from "../AppLink";
import type { BoardAnswer } from "../boardRead";
import { BoardFace, YouLabel } from "../leaderboard/BoardFace";
import { joinWords, leftWords } from "../leaderboard/ViewerLine";
import type { Leaderboard, LeaderboardRow } from "../shell";
import { PageLink, Panel } from "./Panel";

const label = { id: "leaderboard", label: "Where you stand", aside: "This week" } as const;

export function StandingPanel({ board }: { board: BoardAnswer | undefined }) {
  if (board === undefined || board.kind === "connecting") return <Panel {...label} busy />;
  if (board.kind === "broken") return <Panel {...label}><PageLink feature="leaderboard" /></Panel>;
  if (board.kind !== "board") return null;
  return (
    <Panel {...label}>
      <EveryoneRow board={board} />
      <div className="border-t pt-3">
        <PageLink feature="leaderboard" />
      </div>
    </Panel>
  );
}

function EveryoneRow({ board: { standing, rows } }: { board: Leaderboard }) {
  if (standing.kind !== "ranked") {
    return (
      <div className="flex flex-col gap-1">
        <BoardName />
        <p className="text-sm text-muted-foreground">{standing.kind === "left" ? leftWords : joinWords.week}</p>
      </div>
    );
  }
  const viewerAt = standing.position - 1;
  const you = rows[viewerAt]!;
  const place = you.tied ? `you're tied at #${standing.rank}` : `you're #${standing.rank}`;
  return (
    <div className="relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fill-hover">
      <AppLink href="/leaderboard" aria-label={`Everyone this week: ${place}`} className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0 after:rounded-lg">
        <span className="flex w-12 shrink-0 flex-col">
          <span className="text-2xl leading-none font-semibold tabular-nums">{`#${standing.rank}`}</span>
          {you.tied && <span className="mt-1 text-[10px] leading-3 text-muted-foreground">tied</span>}
        </span>
        <BoardName />
      </AppLink>
      <ul aria-label="Your neighbours on the board" className="flex shrink-0 items-start gap-1">
        <Neighbour row={rows[viewerAt - 1]} words={(row) => `Above you: ${row.name}, ${row.kudos} kudos given`} />
        <Neighbour row={you} words={(row) => `You: ${row.kudos} kudos given`} />
        <Neighbour row={rows[viewerAt + 1]} words={(row) => `Below you: ${row.name}, ${row.kudos} kudos given`} />
      </ul>
    </div>
  );
}

function BoardName() {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">Everyone</span>
      <span className="truncate text-xs text-muted-foreground">The whole company on one board</span>
    </span>
  );
}

function Neighbour({ row, words }: { row: LeaderboardRow | undefined; words: (row: LeaderboardRow) => string }) {
  if (row === undefined) return <li aria-hidden="true" className="w-9" />;
  return (
    <li className="flex w-9 flex-col items-center gap-1">
      <BoardFace row={row} className={row.you ? "size-8" : "size-6"} />
      <span aria-hidden="true" className={`text-[10px] leading-none tabular-nums ${row.you ? "font-semibold" : "text-muted-foreground"}`}>
        {row.kudos}
      </span>
      {row.you && (
        <span aria-hidden="true">
          <YouLabel />
        </span>
      )}
      <span className="sr-only">{words(row)}</span>
    </li>
  );
}
