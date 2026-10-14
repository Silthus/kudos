import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export async function isOnTheBoards(ctx: QueryCtx, member: MemberId) {
  return (await settingOf(ctx, member))?.visible ?? true;
}

export async function setLeaderboardVisibility(ctx: MutationCtx, member: MemberId, visible: boolean): Promise<boolean> {
  const setting = await settingOf(ctx, member);
  const changed = (setting?.visible ?? true) !== visible;
  if (setting === null) await ctx.db.insert("leaderboardSettings", { member, visible });
  else if (changed) await ctx.db.patch(setting._id, { visible });
  if (changed) await ctx.scheduler.runAfter(0, internal.engine.spotlight.recomputeSpotlightOf, { member, side: "given", before: null });
  return changed;
}

function settingOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("leaderboardSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
