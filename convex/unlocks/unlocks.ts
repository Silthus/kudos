import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { openUnlockCommand, type CommandResult } from "../bus/commands";
import { levelReachedEventValidator } from "../bus/events";
import { publish } from "../bus/publish";
import { republish } from "../feedback/homes";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { chatUserOf, type MemberId } from "../workspace/directory";
import type { Feature } from "./feature";
import { scheduled, shippedIn, type ScheduledFeature } from "./schedule";

export type UnlockState = "unshipped" | "locked" | "ready" | "open";

export type MemberUnlock = { feature: Feature; state: Exclude<UnlockState, "unshipped">; readyAt: number | null; openedAt: number | null };

export type UnlocksHome = { ready: ScheduledFeature[]; next: ScheduledFeature | null };

type UnlockRow = Doc<"unlocks">;

export const makeReady = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event: { workspace, member, level, at } }): Promise<void> => {
    const reached = (await shippedIn(ctx, workspace)).filter((entry) => entry.level <= level);
    let madeReady = false;
    for (const { feature } of reached) {
      if ((await unlockRow(ctx, member, feature)) !== null) continue;
      await ctx.db.insert("unlocks", { member, feature, readyAt: at });
      await publish(ctx, { type: "unlockReady", workspace, member, feature, at });
      madeReady = true;
    }
    if (madeReady && (await xpLevelsShownIn(ctx, workspace))) await republish(ctx, member);
  },
});

export const openUnlock = internalMutation({
  args: { command: openUnlockCommand },
  handler: async (ctx, { command: { member, feature } }): Promise<CommandResult> => {
    const { workspace } = await chatUserOf(ctx, member);
    const row = await unlockRow(ctx, member, feature);
    if (stateFrom(row) !== "ready" || !(await isShipped(ctx, workspace, feature))) return "refused";
    const at = Date.now();
    await ctx.db.patch(row!._id, { openedAt: at });
    await publish(ctx, { type: "unlockOpened", workspace, member, feature, at });
    return "done";
  },
});

export const memberUnlocks = internalQuery({
  args: { member: v.id("members") },
  handler: (ctx, { member }) => unlocksOf(ctx, member),
});

export async function stateOf(ctx: QueryCtx, member: MemberId, feature: Feature): Promise<UnlockState> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await isShipped(ctx, workspace, feature))) return "unshipped";
  return stateFrom(await unlockRow(ctx, member, feature));
}

export async function unlocksOf(ctx: QueryCtx, member: MemberId): Promise<MemberUnlock[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const unlocks: MemberUnlock[] = [];
  for (const { feature } of await shippedIn(ctx, workspace)) {
    const row = await unlockRow(ctx, member, feature);
    unlocks.push({ feature, state: stateFrom(row), readyAt: row?.readyAt ?? null, openedAt: row?.openedAt ?? null });
  }
  return unlocks;
}

export async function unlocksHomeOf(ctx: QueryCtx, member: MemberId): Promise<UnlocksHome> {
  const unlocks = await unlocksOf(ctx, member);
  const withState = (state: MemberUnlock["state"]) => unlocks.filter((unlock) => unlock.state === state).map(({ feature }) => scheduled(feature));
  return { ready: withState("ready"), next: withState("locked")[0] ?? null };
}

async function isShipped(ctx: QueryCtx | MutationCtx, workspace: string, feature: Feature) {
  return (await shippedIn(ctx, workspace)).some((entry) => entry.feature === feature);
}

function stateFrom(row: UnlockRow | null): MemberUnlock["state"] {
  if (row === null) return "locked";
  return row.openedAt === undefined ? "ready" : "open";
}

function unlockRow(ctx: QueryCtx, member: MemberId, feature: Feature) {
  return ctx.db
    .query("unlocks")
    .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", feature))
    .unique();
}
