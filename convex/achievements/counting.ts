import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dayThankedBefore, type AwardId, type AwardWithId, type GivenAward } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { ladderOf, type AwardLadderId, type CompletionLadderId, type LadderId, type Tier, type TierRef } from "./ladders";
import { markOf, stepOf, type Mark, type MarkedLadder } from "./measures";
import { thanksAnOldFriend } from "./oldFriends";
import type { BatchId } from "./replay";
import { earnTier } from "./tiers";

export type Counting = { member: MemberId; ladder: LadderId };

export type AwardCounting = { member: MemberId; ladder: AwardLadderId };

export type CompletionCounting = { workspace: string; member: MemberId; ladder: CompletionLadderId };

export type Completion = { award: AwardId; at: number; told: boolean };

export type CompletionTier = { tier: TierRef; reaching: Completion };

export type DatedAward = GivenAward & { at: number };

type Units = (ctx: MutationCtx, counting: AwardCounting, award: DatedAward) => Promise<number>;

const givenBy = ({ giver }: AwardWithId) => giver;

const countedMember: Record<AwardLadderId, (award: AwardWithId) => MemberId> = {
  generosity: givenBy,
  recognition: ({ recipient }) => recipient,
  connections: givenBy,
  dependability: givenBy,
  applause: givenBy,
  seasons: givenBy,
  "old-friends": givenBy,
};

const kudosUnits: Units = async (_ctx, _counting, { kudos }) => kudos;

const unitsCounted: Record<AwardLadderId, Units> = {
  generosity: kudosUnits,
  recognition: kudosUnits,
  connections: unitsMarked("connections"),
  dependability: unitsMarked("dependability"),
  applause: unitsMarked("applause"),
  seasons: unitsMarked("seasons"),
  "old-friends": async (ctx, _counting, { award, day }) => (thanksAnOldFriend(await dayThankedBefore(ctx, award), day) ? 1 : 0),
};

export function countingOf(ladder: AwardLadderId, award: AwardWithId): AwardCounting {
  return { member: countedMember[ladder](award), ladder };
}

export type Earning = { tiers: Tier[]; batch?: BatchId; hidden?: true };

export async function countAward(ctx: MutationCtx, workspace: string, counting: AwardCounting, award: DatedAward, { tiers, batch, hidden }: Earning): Promise<TierRef[] | null> {
  if (await isCounted(ctx, counting, award.award)) return null;
  const { before, after } = await addToCount(ctx, counting, await unitsCounted[counting.ladder](ctx, counting, award));
  await ctx.db.insert("countedAwards", { ...counting, award: award.award, count: after, at: award.at });
  const reaching = { workspace, ...counting, award: award.award, at: award.at, batch, hidden };
  const earned: TierRef[] = [];
  for (const tier of tiers) {
    if (before < tier.count && tier.count <= after && (await earnTier(ctx, reaching, tier))) earned.push({ ladder: counting.ladder, tier: tier.tier });
  }
  return earned;
}

export async function countCompletions(ctx: MutationCtx, { workspace, member, ladder }: CompletionCounting, completions: Completion[], { hidden }: Pick<Earning, "hidden">): Promise<CompletionTier[]> {
  await setCount(ctx, { member, ladder }, completions.length);
  const told: CompletionTier[] = [];
  for (const tier of ladderOf(ladder).tiers) {
    const reaching = completions[tier.count - 1];
    if (reaching === undefined) continue;
    const silent = hidden ?? (reaching.told ? undefined : true);
    const earned = await earnTier(ctx, { workspace, member, ladder, award: reaching.award, at: reaching.at, hidden: silent }, tier);
    if (earned && silent === undefined) told.push({ tier: { ladder, tier: tier.tier }, reaching });
  }
  return told;
}

export async function awardReaching(ctx: QueryCtx, { member, ladder }: AwardCounting, count: number): Promise<{ award: AwardId; at: number } | null> {
  return ctx.db
    .query("countedAwards")
    .withIndex("by_member_ladder_count", (q) => q.eq("member", member).eq("ladder", ladder).gte("count", count))
    .first();
}

export async function countOf(ctx: QueryCtx, counting: Counting): Promise<number> {
  return (await countRow(ctx, counting))?.count ?? 0;
}

function unitsMarked(ladder: MarkedLadder): Units {
  return async (ctx, counting, award) => {
    const mark = markOf(ladder, award);
    const { adds, keeps } = stepOf(mark, await markedIn(ctx, counting, mark));
    if (keeps) await ctx.db.insert("ladderMarks", { ...counting, group: mark.group, key: mark.key });
    return adds;
  };
}

async function markedIn(ctx: QueryCtx, { member, ladder }: AwardCounting, { group, distinct }: Mark): Promise<string[]> {
  const marks = await ctx.db
    .query("ladderMarks")
    .withIndex("by_member_ladder_group", (q) => q.eq("member", member).eq("ladder", ladder).eq("group", group))
    .take(distinct);
  return marks.map(({ key }) => key);
}

async function addToCount(ctx: MutationCtx, counting: Counting, units: number) {
  const row = await countRow(ctx, counting);
  const before = row?.count ?? 0;
  const after = before + units;
  if (row === null) await ctx.db.insert("ladderCounts", { ...counting, count: after });
  else await ctx.db.patch(row._id, { count: after });
  return { before, after };
}

async function isCounted(ctx: QueryCtx, { member, ladder }: AwardCounting, award: AwardId) {
  const row = await ctx.db
    .query("countedAwards")
    .withIndex("by_award_member_ladder", (q) => q.eq("award", award).eq("member", member).eq("ladder", ladder))
    .unique();
  return row !== null;
}

async function setCount(ctx: MutationCtx, counting: Counting, count: number) {
  const row = await countRow(ctx, counting);
  if (row === null) await ctx.db.insert("ladderCounts", { ...counting, count });
  else if (row.count !== count) await ctx.db.patch(row._id, { count });
}

function countRow(ctx: QueryCtx, { member, ladder }: Counting) {
  return ctx.db
    .query("ladderCounts")
    .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
    .unique();
}
