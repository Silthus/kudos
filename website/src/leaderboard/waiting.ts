import type { MemberProfile } from "../shell";

export function leaderboardWaitsFor({ leaderboard, leaderboardLevel }: Pick<MemberProfile, "leaderboard" | "leaderboardLevel">) {
  if (leaderboard === "locked") return leaderboardOpensAt(leaderboardLevel);
  if (leaderboard === "ready") return leaderboardIsReady;
  return undefined;
}

export function leaderboardOpensAt(level: number) {
  return `Leaderboard opens at level ${level}.`;
}

export const leaderboardIsReady = "Leaderboard is ready for you. Open it in Slack's App Home.";
