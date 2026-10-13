import type { Leaderboard } from "../leaderboardFixtures";
import type { Period } from "../shell";
import { ThankInSlack } from "./ThankInSlack";

const joinWords: Record<Period, string> = {
  week: "Give kudos this week to join the board.",
  month: "Give kudos this month to join the board.",
  all: "Give kudos to join the board.",
};

export function viewerLineOf(board: Leaderboard) {
  if (board.standing.kind === "left") return <p className={line}>You're not on the leaderboards. You can change that in Settings in Slack.</p>;
  if (board.standing.kind === "ranked") return undefined;
  return (
    <div className={`${line} flex flex-wrap items-center justify-between gap-3`}>
      <p>{joinWords[board.period]}</p>
      <ThankInSlack chatUrl={board.chatUrl} variant="outline" />
    </div>
  );
}

const line = "border-t bg-fill-selected px-3 py-3 text-sm text-muted-foreground shadow-[inset_3px_0_0_var(--primary)]";
