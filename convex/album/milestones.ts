import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { companyTeamsReplacedEventValidator, hoggieDroppedEventValidator } from "../bus/events";
import { collectionOf } from "../hoggies/collection";
import { membersPageIn, type MemberId } from "../workspace/directory";
import { workspacesKnown } from "../workspace/settings";
import { milestoneCatalogue, type MilestoneId, type Step } from "./milestoneCatalogue";
import type { MilestoneTier } from "./records";
import { peopleHeldBy } from "./stickers";
import { companyCopyIn, teamPagesIn, teamPagesOf, type PageOwner, type TeamPage } from "./teamPages";

export type MilestoneAnswer = { id: MilestoneId; count: number; tiers: (Step & { earnedAt: number | null })[] };

type Counts = Record<MilestoneId, number>;

export const membersPerMilestonePage = 25;

export const recordMilestonesInWorkspace = internalMutation({
  args: { workspace: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { workspace, cursor }) => {
    const { members, continueCursor } = await membersPageIn(ctx, workspace, cursor, membersPerMilestonePage);
    const company = await companyCopyIn(ctx, workspace);
    for (const member of members) await recordTiersOf(ctx, member, () => teamPagesIn(ctx, member, company), Date.now());
    if (continueCursor !== null) await ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesInWorkspace, { workspace, cursor: continueCursor });
    return null;
  },
});

export const recordMilestonesAfterTheSync = internalMutation({
  args: { event: companyTeamsReplacedEventValidator },
  returns: v.null(),
  handler: async (ctx) => {
    for (const workspace of await workspacesKnown(ctx)) await ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesInWorkspace, { workspace, cursor: null });
    return null;
  },
});

export const recordMilestonesAfterAHoggieDrop = internalMutation({
  args: { event: hoggieDroppedEventValidator },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    await recordMilestonesOf(ctx, { workspace: event.workspace, member: event.member }, Date.now());
    return null;
  },
});

export async function milestonesOf(ctx: QueryCtx, owner: PageOwner, pages: TeamPage[]): Promise<MilestoneAnswer[]> {
  const counts = await countsOf(ctx, owner.member, async () => pages);
  const earned = await earnedTiersOf(ctx, owner.member);
  return milestoneCatalogue.milestones.map(({ id, steps }) => ({ id, count: counts[id], tiers: steps.map((step) => ({ ...step, earnedAt: earned.get(tierKey(id, step.tier)) ?? null })) }));
}

export function recordMilestonesOf(ctx: MutationCtx, owner: PageOwner, at: number): Promise<void> {
  return recordTiersOf(ctx, owner.member, () => teamPagesOf(ctx, owner), at);
}

async function recordTiersOf(ctx: MutationCtx, member: MemberId, pagesOf: () => Promise<TeamPage[]>, at: number): Promise<void> {
  const counts = await countsOf(ctx, member, pagesOf);
  const earned = await earnedTiersOf(ctx, member);
  for (const { id, steps } of milestoneCatalogue.milestones) {
    for (const { tier } of steps.filter((step) => counts[id] >= step.at && !earned.has(tierKey(id, step.tier)))) {
      await ctx.db.insert("milestoneTiers", { member, milestone: id, tier, at, catalogue: milestoneCatalogue.version });
    }
  }
}

async function countsOf(ctx: QueryCtx, member: MemberId, pagesOf: () => Promise<TeamPage[]>): Promise<Counts> {
  const people = (await peopleHeldBy(ctx, member)).size;
  const pages = people === 0 ? [] : await pagesOf();
  return {
    people,
    teams: pages.filter(({ state }) => state === "unlocked").length,
    reach: pages.filter(({ held }) => held > 0).length,
    hoggies: (await collectionOf(ctx, member, { crests: false })).owned,
    thoughtful: await thoughtfulAwardsGivenBy(ctx, member),
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
