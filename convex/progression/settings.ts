import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type ProgressSettings = { muteNotices: boolean; dms: boolean };

export async function setProgressSettings(ctx: MutationCtx, member: MemberId, changes: Partial<ProgressSettings>) {
  const row = await settingsRow(ctx, member);
  if (row === null) await ctx.db.insert("progressSettings", { member, ...changes });
  else await ctx.db.patch(row._id, changes);
}

export async function progressSettingsOf(ctx: QueryCtx, member: MemberId): Promise<ProgressSettings> {
  const row = await settingsRow(ctx, member);
  return {
    muteNotices: row?.muteNotices ?? false,
    dms: row?.dms ?? true,
  };
}

function settingsRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("progressSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
