import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { AwardId, AwardWithId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { LadderId, Tier, TierRef } from "./ladders";
import type { BatchId } from "./replay";
import { earnTier } from "./tiers";

export type Counting = { member: MemberId; ladder: LadderId };

export type DatedAward = AwardWithId & { at: number };

const countedMember: Record<LadderId, (award: AwardWithId) => MemberId> = {
  generosity: ({ giver }) => giver,
  recognition: ({ recipient }) => recipient,
};

export function countingOf(ladder: LadderId, award: AwardWithId): Counting {
  return { member: countedMember[ladder](award), ladder };
}

export type Earning = { tiers: Tier[]; batch?: BatchId; hidden?: true };

export async function countAward(ctx: MutationCtx, workspace: string, counting: Counting, award: DatedAward, { tiers, batch, hidden }: Earning): Promise<TierRef[] | null> {
  if (await isCounted(ctx, counting, award.award)) return null;
  const { before, after } = await addToCount(ctx, counting, award.kudos);
  await ctx.db.insert("countedAwards", { ...counting, award: award.award, count: after, at: award.at });
  const reaching = { workspace, ...counting, award: award.award, at: award.at, batch, hidden };
  const earned: TierRef[] = [];
  for (const tier of tiers) {
    if (before < tier.count && tier.count <= after && (await earnTier(ctx, reaching, tier))) earned.push({ ladder: counting.ladder, tier: tier.tier });
  }
  return earned;
}

export async function awardReaching(ctx: QueryCtx, { member, ladder }: Counting, count: number): Promise<{ award: AwardId; at: number } | null> {
  return ctx.db
    .query("countedAwards")
    .withIndex("by_member_ladder_count", (q) => q.eq("member", member).eq("ladder", ladder).gte("count", count))
    .first();
}

export async function countOf(ctx: QueryCtx, counting: Counting): Promise<number> {
  return (await countRow(ctx, counting))?.count ?? 0;
}

async function addToCount(ctx: MutationCtx, counting: Counting, kudos: number) {
  const row = await countRow(ctx, counting);
  const before = row?.count ?? 0;
  const after = before + kudos;
  if (row === null) await ctx.db.insert("ladderCounts", { ...counting, count: after });
  else await ctx.db.patch(row._id, { count: after });
  return { before, after };
}

async function isCounted(ctx: QueryCtx, { member, ladder }: Counting, award: AwardId) {
  const row = await ctx.db
    .query("countedAwards")
    .withIndex("by_award_member_ladder", (q) => q.eq("award", award).eq("member", member).eq("ladder", ladder))
    .unique();
  return row !== null;
}

function countRow(ctx: QueryCtx, { member, ladder }: Counting) {
  return ctx.db
    .query("ladderCounts")
    .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
    .unique();
}
