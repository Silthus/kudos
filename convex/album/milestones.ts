import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { companyMatchesKeptEventValidator, hoggieDroppedEventValidator } from "../bus/events";
import { collectionOf } from "../hoggies/collection";
import { givenDecidedAfter } from "../engine/awards";
import { earnTierItem } from "../items/achievements";
import { saysWhy } from "../progression/gate";
import type { Moved } from "../quests/progress";
import { chatUserOf, membersPageIn, type MemberId } from "../workspace/directory";
import { milestoneCatalogue, type MilestoneId, type Step } from "./milestoneCatalogue";
import type { MilestoneTier } from "./records";
import { holdsAnySticker, nextStickerHolderAfter, peopleHeldBy } from "./stickers";
import { teamPagesOf, type PageOwner, type TeamPage } from "./teamPages";

export type MilestoneAnswer = { id: MilestoneId; count: number; tiers: (Step & { earnedAt: number | null; unlockedAt?: number })[] };

export type ReachedTier = { milestone: MilestoneId; tier: MilestoneTier };

type Counts = Record<MilestoneId, number>;

export const membersPerMilestonePage = 25;

export const holdersScannedAMutation = 100;

export const recordMilestonesInWorkspace = internalMutation({
  args: { workspace: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { workspace, cursor }) => {
    const { members, continueCursor } = await membersPageIn(ctx, workspace, cursor, membersPerMilestonePage);
    for (const member of members) if (!(await holdsAnySticker(ctx, member))) await recordTiersOf(ctx, { workspace, member }, async () => [], Date.now());
    if (continueCursor !== null) await ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesInWorkspace, { workspace, cursor: continueCursor });
    else await recordStickerHoldersLater(ctx, workspace);
    return null;
  },
});

export const recordMilestonesAfterTheMatches = internalMutation({
  args: { event: companyMatchesKeptEventValidator },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    await recordStickerHoldersLater(ctx, event.workspace);
    return null;
  },
});

export const recordMilestonesOfStickerHolders = internalMutation({
  args: { workspace: v.string(), after: v.union(v.id("members"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { workspace, after }) => {
    const holder = await nextHolderIn(ctx, workspace, after);
    if (holder.found !== null) await recordMilestonesOf(ctx, { workspace, member: holder.found }, Date.now());
    if (holder.last !== null) await ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesOfStickerHolders, { workspace, after: holder.last });
    return null;
  },
});

export const recordMilestonesAfterAHoggieDrop = internalMutation({
  args: { event: hoggieDroppedEventValidator },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    await recordMilestonesOf(ctx, { workspace: event.workspace, member: event.member }, event.at);
    return null;
  },
});

function recordStickerHoldersLater(ctx: MutationCtx, workspace: string) {
  return ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesOfStickerHolders, { workspace, after: null });
}

async function nextHolderIn(ctx: QueryCtx, workspace: string, after: MemberId | null): Promise<{ found: MemberId | null; last: MemberId | null }> {
  let last = after;
  for (let scanned = 0; scanned < holdersScannedAMutation; scanned += 1) {
    const next = await nextStickerHolderAfter(ctx, last);
    if (next === null) return { found: null, last: null };
    last = next;
    if ((await chatUserOf(ctx, next)).workspace === workspace) return { found: next, last };
  }
  return { found: null, last };
}

export async function milestonesOf(ctx: QueryCtx, owner: PageOwner, pages: TeamPage[]): Promise<MilestoneAnswer[]> {
  const counts = await countsOf(ctx, owner.member, async () => pages);
  const earned = await earnedTiersOf(ctx, owner.member);
  return milestoneCatalogue.milestones.map(({ id, steps }) => ({ id, count: counts[id], tiers: steps.map((step) => ({ ...step, earnedAt: earned.get(tierKey(id, step.tier)) ?? null })) }));
}

export function recordMilestonesOf(ctx: MutationCtx, owner: PageOwner, at: number): Promise<ReachedTier[]> {
  return recordTiersOf(ctx, owner, () => teamPagesOf(ctx, owner), at);
}

async function recordTiersOf(ctx: MutationCtx, owner: PageOwner, pagesOf: () => Promise<TeamPage[]>, at: number): Promise<ReachedTier[]> {
  const { member } = owner;
  const { counts, hoggieFirstFinds } = await factsOf(ctx, member, pagesOf);
  const earned = await earnedTiersOf(ctx, member);
  const reached: ReachedTier[] = [];
  for (const { id, steps } of milestoneCatalogue.milestones) {
    for (const step of steps.filter(({ at: needed, tier }) => counts[id] >= needed && !earned.has(tierKey(id, tier)))) {
      const reachedAt = id === "hoggies" ? (hoggieFirstFinds[step.at - 1] ?? at) : at;
      await ctx.db.insert("milestoneTiers", { member, milestone: id, tier: step.tier, at: reachedAt, catalogue: milestoneCatalogue.version });
      await earnTierItem(ctx, owner, { milestone: id, tier: step.tier }, at);
      reached.push({ milestone: id, tier: step.tier });
    }
  }
  return reached;
}

export async function tiersEarnedBy(ctx: QueryCtx, member: MemberId): Promise<ReachedTier[]> {
  const earned = await earnedTiersOf(ctx, member);
  return milestoneCatalogue.milestones.flatMap(({ id, steps }) => steps.filter(({ tier }) => earned.has(tierKey(id, tier))).map(({ tier }) => ({ milestone: id, tier })));
}

export async function thoughtfulMovedSince(ctx: QueryCtx, member: MemberId, since: number, until: number): Promise<Moved[]> {
  const givenSince = (await givenDecidedAfter(ctx, member, since)).filter(({ annotations }) => saysWhy(annotations));
  const from = Math.max((await thoughtfulAwardsGivenBy(ctx, member)) - givenSince.length, 0);
  const to = from + givenSince.filter(({ decided }) => decided <= until).length;
  const next = milestoneCatalogue.milestones.find(({ id }) => id === "thoughtful")!.steps.find((step) => step.at > from);
  return next === undefined || to === from ? [] : [{ name: next.name, from, to: Math.min(to, next.at), of: next.at }];
}

async function countsOf(ctx: QueryCtx, member: MemberId, pagesOf: () => Promise<TeamPage[]>): Promise<Counts> {
  return (await factsOf(ctx, member, pagesOf)).counts;
}

async function factsOf(ctx: QueryCtx, member: MemberId, pagesOf: () => Promise<TeamPage[]>): Promise<{ counts: Counts; hoggieFirstFinds: number[] }> {
  const people = (await peopleHeldBy(ctx, member)).size;
  const pages = people === 0 ? [] : await pagesOf();
  const hoggieFirstFinds = (await collectionOf(ctx, member, { crests: false })).hoggies.flatMap(({ count, firstAt }) => (count > 0 && firstAt !== null ? [firstAt] : [])).toSorted((one, other) => one - other);
  return {
    counts: {
      people,
      teams: pages.filter(({ state }) => state === "unlocked").length,
      reach: pages.filter(({ held }) => held > 0).length,
      hoggies: hoggieFirstFinds.length,
      thoughtful: await thoughtfulAwardsGivenBy(ctx, member),
    },
    hoggieFirstFinds,
  };
}

async function thoughtfulAwardsGivenBy(ctx: QueryCtx, member: MemberId): Promise<number> {
  const weeks = await ctx.db
    .query("weekTallies")
    .withIndex("by_member_week", (q) => q.eq("member", member))
    .collect();
  return weeks.reduce((sum, { thoughtfulGiven }) => sum + thoughtfulGiven, 0);
}

async function earnedTiersOf(ctx: QueryCtx, member: MemberId): Promise<Map<string, number>> {
  const tiers = await ctx.db
    .query("milestoneTiers")
    .withIndex("by_member_milestone_tier", (q) => q.eq("member", member))
    .collect();
  return new Map(tiers.map(({ milestone, tier, at }) => [tierKey(milestone, tier), at]));
}

function tierKey(milestone: MilestoneId, tier: MilestoneTier) {
  return `${milestone}:${tier}`;
}
