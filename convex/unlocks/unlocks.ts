import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import { publish } from "../bus/publish";
import { rangesBefore, type Before } from "../engine/awards";
import { republish } from "../feedback/homes";
import { notifyLevelReached } from "../feedback/notify";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { chatUserOf, type MemberId } from "../workspace/directory";
import type { Feature } from "./feature";
import { unlocksLiveFor, unlocksShownTo } from "./launch";
import { scheduled, shippedTo, type ScheduledFeature } from "./schedule";

export type UnlockState = "unshipped" | "locked" | "ready" | "open";

export type MemberUnlock = { feature: Feature; state: Exclude<UnlockState, "unshipped">; readyAt: number | null; openedAt: number | null };

export type UnlocksHome = { ready: ScheduledFeature[]; next: ScheduledFeature | null };

type UnlockRow = Doc<"unlocks">;

export const makeReady = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    const { workspace, member, level, at } = event;
    if ((await levelUpOf(ctx, member, level)) !== null) return;
    await unlocksLiveFor(ctx, member);
    const madeReady = await storeReadiness(ctx, { workspace, member, at }, reachedAt(await shippedTo(ctx, member), level));
    await ctx.db.insert("levelUps", { member, level, ready: madeReady.map(({ feature }) => feature), at });
    await notifyLevelReached(ctx, event, madeReady);
    if (madeReady.length > 0 && (await xpLevelsOnFor(ctx, member))) await republish(ctx, member);
  },
});

export async function openUnlock(ctx: MutationCtx, member: MemberId, feature: Feature): Promise<"done" | "refused"> {
  if (!(await unlocksShownTo(ctx, member))) return "refused";
  const { workspace } = await chatUserOf(ctx, member);
  if ((await stateOf(ctx, member, feature)) !== "ready") return "refused";
  await keepOpen(ctx, { workspace, member, at: Date.now() }, feature);
  return "done";
}

export type Opening = { workspace: string; member: MemberId; at: number; byLaunch?: true };

export async function keepOpen(ctx: MutationCtx, { workspace, member, at, byLaunch }: Opening, feature: Feature): Promise<boolean> {
  const row = await unlockRow(ctx, member, feature);
  if (row?.openedAt !== undefined) return false;
  if (row === null) await ctx.db.insert("unlocks", { member, feature, readyAt: at, openedAt: at });
  else await ctx.db.patch(row._id, { openedAt: at });
  await publish(ctx, { type: "unlockOpened", workspace, member, feature, at, ...(byLaunch && { byLaunch }) });
  return true;
}

export const memberUnlocks = internalQuery({
  args: { member: v.id("members") },
  handler: (ctx, { member }) => unlocksOf(ctx, member),
});

export async function stateOf(ctx: QueryCtx, member: MemberId, feature: Feature): Promise<UnlockState> {
  if ((await shippedTo(ctx, member, [scheduled(feature)])).length === 0) return "unshipped";
  return stateFrom(await unlockRow(ctx, member, feature));
}

export async function openedAtOf(ctx: QueryCtx, member: MemberId, feature: Feature): Promise<number | null> {
  return (await unlockRow(ctx, member, feature))?.openedAt ?? null;
}

export async function unlocksOf(ctx: QueryCtx, member: MemberId): Promise<MemberUnlock[]> {
  const unlocks: MemberUnlock[] = [];
  for (const { feature } of await shippedTo(ctx, member)) {
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

export async function withoutReadiness(ctx: QueryCtx, member: MemberId, features: ScheduledFeature[]) {
  const without: ScheduledFeature[] = [];
  for (const entry of features) if ((await unlockRow(ctx, member, entry.feature)) === null) without.push(entry);
  return without;
}

export function reachedAt(features: readonly ScheduledFeature[], level: number) {
  return features.filter((entry) => entry.level <= level);
}

export async function storeReadiness(ctx: MutationCtx, { workspace, member, at }: { workspace: string; member: MemberId; at: number }, reached: ScheduledFeature[]) {
  const madeReady: ScheduledFeature[] = [];
  for (const entry of reached) {
    if ((await unlockRow(ctx, member, entry.feature)) !== null) continue;
    await ctx.db.insert("unlocks", { member, feature: entry.feature, readyAt: at });
    await publish(ctx, { type: "unlockReady", workspace, member, feature: entry.feature, at });
    madeReady.push(entry);
  }
  return madeReady;
}

function stateFrom(row: UnlockRow | null): MemberUnlock["state"] {
  if (row === null) return "locked";
  return row.openedAt === undefined ? "ready" : "open";
}

export type RecordedLevelUp = { level: number; at: number; created: number };

export async function* levelUpsNewestFirst(ctx: QueryCtx, member: MemberId, before: Before): AsyncGenerator<RecordedLevelUp> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("levelUps")
      .withIndex("by_member_at", (q) => {
        const reached = q.eq("member", member);
        if (range.kind === "older") return range.than === undefined ? reached : reached.lt("at", range.than);
        return range.createdBefore === undefined ? reached.eq("at", range.at) : reached.eq("at", range.at).lt("_creationTime", range.createdBefore);
      })
      .order("desc");
    for await (const { level, at, _creationTime } of rows) yield { level, at, created: _creationTime };
  }
}

function levelUpOf(ctx: QueryCtx, member: MemberId, level: number) {
  return ctx.db
    .query("levelUps")
    .withIndex("by_member_level", (q) => q.eq("member", member).eq("level", level))
    .unique();
}

function unlockRow(ctx: QueryCtx, member: MemberId, feature: Feature) {
  return ctx.db
    .query("unlocks")
    .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", feature))
    .unique();
}
