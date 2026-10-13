import { internalMutation, type QueryCtx } from "../_generated/server";
import { setProgressSettingsCommand, type CommandResult } from "../bus/commands";
import type { MemberId } from "../workspace/directory";

export type ProgressSettings = { hideLevel: boolean; hideAchievements: boolean; muteNotices: boolean; dms: boolean };

export const setProgressSettings = internalMutation({
  args: { command: setProgressSettingsCommand },
  handler: async (ctx, { command: { type: _, member, ...changes } }): Promise<CommandResult> => {
    const row = await settingsRow(ctx, member);
    if (row === null) await ctx.db.insert("progressSettings", { member, ...changes });
    else await ctx.db.patch(row._id, changes);
    return "done";
  },
});

export async function progressSettingsOf(ctx: QueryCtx, member: MemberId): Promise<ProgressSettings> {
  const row = await settingsRow(ctx, member);
  return {
    hideLevel: row?.hideLevel ?? false,
    hideAchievements: row?.hideAchievements ?? false,
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
