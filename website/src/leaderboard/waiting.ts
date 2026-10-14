import type { LeaderboardWaits } from "../shell";

export function leaderboardWaitingWords(waiting: LeaderboardWaits) {
  return waiting.kind === "ready" ? "Leaderboard is ready for you. Open it in Slack's App Home." : `Leaderboard opens at level ${waiting.level}.`;
}
