import type { MutationCtx, QueryCtx } from "../_generated/server";
import { markEmojiSeen, seenAtOf } from "../album/earnedEmojis";
import { recordMilestonesOf, tiersEarnedBy, type MilestoneAnswer, type ReachedTier } from "../album/milestones";
import type { MilestoneId } from "../album/milestoneCatalogue";
import type { PageOwner } from "../album/teamPages";
import type { MemberId } from "../workspace/directory";
import { hiddenItemsShownTo } from "./flag";

type AnsweredTier = MilestoneAnswer["tiers"][number];

export async function unlockMilestoneTiers(ctx: MutationCtx, owner: PageOwner, at: number): Promise<ReachedTier[]> {
  await recordMilestonesOf(ctx, owner, at);
  const unlocked: ReachedTier[] = [];
  for (const tier of await tiersEarnedBy(ctx, owner.member)) if (await markEmojiSeen(ctx, owner.member, tierEmojiOf(tier), at)) unlocked.push(tier);
  return unlocked;
}

export async function tiersTurnedBy(ctx: QueryCtx, member: MemberId): Promise<ReachedTier[]> {
  const earned = await tiersEarnedBy(ctx, member);
  if (!(await hiddenItemsShownTo(ctx, member))) return earned;
  const turned: ReachedTier[] = [];
  for (const tier of earned) if ((await seenAtOf(ctx, member, tierEmojiOf(tier))) !== null) turned.push(tier);
  return turned;
}

export async function milestonesHeldForTheirTurn(ctx: QueryCtx, member: MemberId, milestones: MilestoneAnswer[]): Promise<MilestoneAnswer[]> {
  const held: MilestoneAnswer[] = [];
  for (const milestone of milestones) held.push({ ...milestone, tiers: await tiersHeldOf(ctx, member, milestone) });
  return held;
}

async function tiersHeldOf(ctx: QueryCtx, member: MemberId, { id, tiers }: MilestoneAnswer): Promise<AnsweredTier[]> {
  const held: AnsweredTier[] = [];
  for (const tier of tiers) held.push(await heldUntilSeen(ctx, member, id, tier));
  return held;
}

async function heldUntilSeen(ctx: QueryCtx, member: MemberId, milestone: MilestoneId, tier: AnsweredTier): Promise<AnsweredTier> {
  if (tier.earnedAt === null) return tier;
  const seenAt = await seenAtOf(ctx, member, tierEmojiOf({ milestone, tier: tier.tier }));
  return seenAt === null ? { ...tier, earnedAt: null } : { ...tier, unlockedAt: Math.max(tier.earnedAt, seenAt) };
}

function tierEmojiOf({ milestone, tier }: ReachedTier) {
  return `milestone:${milestone}:${tier}`;
}
