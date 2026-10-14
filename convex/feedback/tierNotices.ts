import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { achievementsApplyIn } from "../achievements/flag";
import { ladders, tierNameOf, tierRefValidator, type TierRef } from "../achievements/ladders";
import type { BatchId } from "../achievements/replay";
import { everyTierEarnedBy } from "../achievements/tiers";
import { unlockOpenedEventValidator } from "../bus/events";
import type { MessageRef } from "../engine/messageEvent";
import { openedAtOf } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { notify } from "./notify";
import { announce, setPublicSection, type PublicSection } from "./publicReplies";
import { isOpened } from "./unlockFilter";

export const tierNoticeValidator = v.object({
  member: v.id("members"),
  workspace: v.string(),
  conversation: v.string(),
  message: v.string(),
  tiers: v.array(tierRefValidator),
});

export const tierSummaryValidator = v.object({
  member: v.id("members"),
  workspace: v.string(),
  tiers: v.array(tierRefValidator),
  batch: v.optional(v.id("bookBatches")),
});

type BatchTelling = { batch: BatchId; announced: boolean };

export type TiersEarned = { member: MemberId; message: MessageRef; at: number; earned: TierRef[] };

const membersPerPage = 100;

export async function tellTiersEarned(ctx: MutationCtx, { member, message, at, earned }: TiersEarned) {
  if (earned.length === 0) return;
  if (!(await wasOpenedBy(ctx, member, at))) return tellUntoldTiers(ctx, member);
  const notice = await tierNoticeRow(ctx, member, message);
  const told = notice?.tiers ?? [];
  const untold = earned.filter((tier) => !told.some((each) => isSameTier(each, tier)));
  if (untold.length === 0) return;
  const tiers = [...told, ...untold];
  if (notice === null) await ctx.db.insert("tierNotices", { member, ...message, tiers });
  else await ctx.db.patch(notice._id, { tiers });
  await notify(ctx, member, { kind: "tiers-earned", tiers: untold });
  const { user } = await chatUserOf(ctx, member);
  await setPublicSection(ctx, message, tierSection(member, user, tiers));
}

export const tellOpeningSummary = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: (ctx, { event }) => tellUntoldTiers(ctx, event.member),
});

export const tellBatchSummaries = internalMutation({
  args: { batch: v.id("bookBatches"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { batch, cursor }): Promise<void> => {
    const row = await ctx.db.get(batch);
    if (row?.completedAt === undefined) return;
    const members = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", row.workspace))
      .paginate({ cursor, numItems: membersPerPage });
    for (const { _id: member } of members.page) {
      if (await wasOpenedBy(ctx, member, row.completedAt)) await tellBatchTo(ctx, member, { batch, announced: await wasOpenedBefore(ctx, member, row.at) });
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.feedback.tierNotices.tellBatchSummaries, { batch, cursor: members.continueCursor });
  },
});

async function tellBatchTo(ctx: MutationCtx, member: MemberId, telling: BatchTelling) {
  await tellUntoldTiers(ctx, member, telling);
  await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, await chatUserOf(ctx, member));
}

async function tellUntoldTiers(ctx: MutationCtx, member: MemberId, { batch, announced }: Partial<BatchTelling> = {}) {
  const { workspace, user } = await chatUserOf(ctx, member);
  if (!(await achievementsApplyIn(ctx, workspace)) || !(await isOpened(ctx, member, "book"))) return;
  const tiers = await untoldTiersOf(ctx, member, batch);
  if (tiers.length === 0) return;
  const summary = await ctx.db.insert("tierSummaries", { member, workspace, tiers, batch });
  await notify(ctx, member, { kind: "tiers-earned", tiers });
  if (announced === true) await announce(ctx, workspace, { summary }, tierSection(member, user, tiers));
}

async function untoldTiersOf(ctx: QueryCtx, member: MemberId, batch: BatchId | undefined): Promise<TierRef[]> {
  const told = await toldTiersOf(ctx, member);
  const earned = await tellableTiersOf(ctx, member, batch);
  return ladders.ladders.flatMap(({ ladder, tiers }) =>
    tiers.map(({ tier }) => ({ ladder, tier })).filter((ref) => earned.some((row) => isSameTier(row, ref)) && !told.some((each) => isSameTier(each, ref))),
  );
}

async function tellableTiersOf(ctx: QueryCtx, member: MemberId, batch: BatchId | undefined) {
  const shown = (await everyTierEarnedBy(ctx, member)).filter((row) => row.hidden !== true);
  if (batch !== undefined) return shown.filter((row) => row.batch === batch);
  const unfinished = await unfinishedBatchesAmong(ctx, shown.map((row) => row.batch));
  return shown.filter((row) => row.batch === undefined || !unfinished.has(row.batch));
}

async function unfinishedBatchesAmong(ctx: QueryCtx, batches: Array<BatchId | undefined>) {
  const unfinished = new Set<BatchId>();
  for (const batch of new Set(batches)) {
    if (batch !== undefined && (await ctx.db.get(batch))?.completedAt === undefined) unfinished.add(batch);
  }
  return unfinished;
}

async function toldTiersOf(ctx: QueryCtx, member: MemberId): Promise<TierRef[]> {
  const notices = await ctx.db
    .query("tierNotices")
    .withIndex("by_member_message", (q) => q.eq("member", member))
    .collect();
  const summaries = await ctx.db
    .query("tierSummaries")
    .withIndex("by_member", (q) => q.eq("member", member))
    .collect();
  return [...notices, ...summaries].flatMap(({ tiers }) => tiers);
}

function tierSection(member: MemberId, user: string, tiers: TierRef[]): PublicSection {
  const names = listOf(tiers.map(tierNameOf));
  return { key: `achievement:${user}`, member, about: "achievement", line: [{ text: "🏅 " }, { mention: { kind: "person", user } }, { text: ` earned ${names}.` }] };
}

function listOf(names: string[]) {
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

async function wasOpenedBy(ctx: QueryCtx, member: MemberId, at: number) {
  const openedAt = await openedAtOf(ctx, member, "book");
  return openedAt !== null && openedAt <= at && (await isOpened(ctx, member, "book"));
}

async function wasOpenedBefore(ctx: QueryCtx, member: MemberId, at: number) {
  const openedAt = await openedAtOf(ctx, member, "book");
  return openedAt !== null && openedAt < at;
}

function isSameTier(one: TierRef, other: TierRef) {
  return one.ladder === other.ladder && one.tier === other.tier;
}

function tierNoticeRow(ctx: QueryCtx, member: MemberId, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("tierNotices")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
}
