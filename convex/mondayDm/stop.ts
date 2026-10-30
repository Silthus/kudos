import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx } from "../_generated/server";
import { reportMessageSettingChanged } from "../analytics/isolatedUsage";
import type { MessagePlace } from "../messageSettings/kinds";
import { placeOf, setMessageSetting } from "../messageSettings/messageSettings";
import { onTheMondayPath } from "../quests/flag";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { hypeNudgeOf } from "./hypeNudge";
import type { MondayDmContent } from "./records";

export type ShownMondayDm = { workspace: string; content: MondayDmContent; nudge: string | null; stopped: boolean };

export type PressedIn = { channel: string; ts: string } | undefined;

export function stopMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">, pressedIn: PressedIn) {
  return placeMondayQuests(ctx, workspace, member, dm, "none", pressedIn);
}

export function resumeMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">, pressedIn: PressedIn) {
  return placeMondayQuests(ctx, workspace, member, dm, "dm", pressedIn);
}

export const shownMondayDm = internalQuery({
  args: { dm: v.id("mondayDms") },
  handler: async (ctx, { dm }): Promise<ShownMondayDm | null> => {
    const row = await ctx.db.get(dm);
    if (row?.content === undefined) return null;
    const { workspace } = await chatUserOf(ctx, row.member);
    return { workspace, content: row.content, nudge: await hypeNudgeOf(ctx, dm), stopped: (await placeOf(ctx, row.member, "quests")) === "none" };
  },
});

async function placeMondayQuests(ctx: MutationCtx, workspace: string, member: MemberId, dm: Id<"mondayDms">, place: MessagePlace, pressedIn: PressedIn) {
  const row = await ctx.db.get(dm);
  if (row?.member !== member || !(await onTheMondayPath(ctx, member))) return;
  if (await setMessageSetting(ctx, member, "quests", place)) await reportMessageSettingChanged(ctx, { workspace, member, setting: "quests", on: place !== "none", place, via: "dm-button", at: Date.now() });
  if (pressedIn !== undefined) await ctx.scheduler.runAfter(0, internal.slack.mondayDm.showMondayDm, { dm, ...pressedIn });
}
