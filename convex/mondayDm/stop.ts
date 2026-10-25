import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx } from "../_generated/server";
import { reportMessageSettingChanged } from "../analytics/isolatedUsage";
import type { MessagePlace } from "../messageSettings/kinds";
import { placeOf, setMessageSetting } from "../messageSettings/messageSettings";
import { onTheMondayPath } from "../quests/flag";
import { chatUserOf, type MemberId } from "../workspace/directory";
import type { MondayDmContent, PostedMessage } from "./records";

export type ShownMondayDm = { workspace: string; posted: PostedMessage; content: MondayDmContent; stopped: boolean };

export function stopMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">) {
  return placeMondayQuests(ctx, workspace, member, dm, "none");
}

export function resumeMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">) {
  return placeMondayQuests(ctx, workspace, member, dm, "dm");
}

export const shownMondayDm = internalQuery({
  args: { dm: v.id("mondayDms") },
  handler: async (ctx, { dm }): Promise<ShownMondayDm | null> => {
    const row = await ctx.db.get(dm);
    if (row?.posted === undefined || row.content === undefined) return null;
    const { workspace } = await chatUserOf(ctx, row.member);
    return { workspace, posted: row.posted, content: row.content, stopped: (await placeOf(ctx, row.member, "quests")) === "none" };
  },
});

async function placeMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">, place: MessagePlace) {
  const row = await ctx.db.get(dm);
  if (row?.member !== member || !(await onTheMondayPath(ctx, member))) return;
  if (await setMessageSetting(ctx, member, "quests", place)) await reportMessageSettingChanged(ctx, { workspace, member, setting: "quests", on: place !== "none", place, via: "dm-button", at: Date.now() });
  await ctx.scheduler.runAfter(0, internal.slack.mondayDm.showMondayDm, { dm });
}
