import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export async function isOnTheBoards(ctx: QueryCtx, member: MemberId) {
  return (await settingOf(ctx, member))?.visible ?? true;
}

export async function setLeaderboardVisibility(ctx: MutationCtx, member: MemberId, visible: boolean) {
  const setting = await settingOf(ctx, member);
  if (setting === null) await ctx.db.insert("leaderboardSettings", { member, visible });
  else if (setting.visible !== visible) await ctx.db.patch(setting._id, { visible });
}

function settingOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("leaderboardSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
