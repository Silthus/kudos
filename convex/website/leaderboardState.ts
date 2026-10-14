import type { QueryCtx } from "../_generated/server";
import { everyoneBoardShownIn } from "../leaderboard/flag";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { scheduled } from "../unlocks/schedule";
import { stateOf } from "../unlocks/unlocks";
import type { VerifiedMember } from "./memberQuery";

export type LeaderboardState = { kind: "off" } | { kind: "locked"; level: number } | { kind: "ready" } | { kind: "open" };

export type LeaderboardWaits = Extract<LeaderboardState, { kind: "locked" | "ready" }>;

export async function leaderboardStateOf(ctx: QueryCtx, me: VerifiedMember): Promise<LeaderboardState> {
  if (!(await unlocksApplyIn(ctx, me.workspace))) return (await everyoneBoardShownIn(ctx, me.workspace)) ? { kind: "open" } : { kind: "off" };
  const state = await stateOf(ctx, me.member, "leaderboard");
  if (state === "unshipped") return { kind: "off" };
  if (state === "locked") return { kind: "locked", level: scheduled("leaderboard").level };
  return { kind: state };
}

async function unlocksApplyIn(ctx: QueryCtx, workspace: string) {
  return (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}
