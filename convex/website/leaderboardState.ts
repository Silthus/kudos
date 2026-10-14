import type { QueryCtx } from "../_generated/server";
import { everyoneBoardShownIn } from "../leaderboard/flag";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { VerifiedMember } from "./memberQuery";

export type LeaderboardState = "off" | "locked" | "ready" | "open";

export async function leaderboardStateOf(ctx: QueryCtx, me: VerifiedMember): Promise<LeaderboardState> {
  if (!(await unlocksApplyIn(ctx, me.workspace))) return (await everyoneBoardShownIn(ctx, me.workspace)) ? "open" : "off";
  const state = await stateOf(ctx, me.member, "leaderboard");
  return state === "unshipped" ? "off" : state;
}

async function unlocksApplyIn(ctx: QueryCtx, workspace: string) {
  return (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}
