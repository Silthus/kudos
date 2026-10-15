import type { QueryCtx } from "../_generated/server";
import { achievementFactsOf, type LadderFacts, type RewardFacts, type TierFacts } from "../achievements/achievements";
import type { LadderId, TierId } from "../achievements/ladders";
import { dayZoneOf } from "../engine/allowance";
import type { Art } from "../store/catalogue";
import { storeVisibleTo } from "../store/visibility";
import { coinsVisibleTo } from "../wallet/visibility";
import { lookup, type MemberId } from "../workspace/directory";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import { featurePageOf, unlockPathOf, type PageWaits } from "./unlockPath";

export type TierReward = { kind: "coins"; coins: number } | { kind: "kudosEmoji"; name: string; art: Art };

export type TierCard = { tier: TierId; name: string; at: number; earnedAt: number | null; seen: string | null; rewards: TierReward[] };

export type LadderCard = { ladder: LadderId; name: string; counts: string; count: number; tiers: TierCard[]; next: { tier: TierId; at: number } | null };

export type BookAnswer = { kind: "not-found" } | PageWaits | { kind: "book"; ladders: LadderCard[]; timeZone: string };

export const getBook = memberQuery(async (ctx, me): Promise<BookAnswer> => {
  const page = featurePageOf(await unlockPathOf(ctx, me), "book");
  if (page.kind === "off") return { kind: "not-found" };
  if (page.kind !== "open") return page;
  const facts = await achievementFactsOf(ctx, me.member);
  if (facts === null) return { kind: "not-found" };
  const shown = { member: me.member, coins: await coinsVisibleTo(ctx, me.member), store: await storeVisibleTo(ctx, me.member) };
  return { kind: "book", ladders: await Promise.all(facts.ladders.map((ladder) => ladderCardOf(ladder, shown))), timeZone: await timeZoneOf(ctx, me) };
});

type Shown = { member: MemberId; coins: boolean; store: boolean };

async function ladderCardOf({ ladder, name, counts, count, tiers, next }: LadderFacts, shown: Shown): Promise<LadderCard> {
  const cards = await Promise.all(tiers.map((tier) => tierCardOf(ladder, tier, shown)));
  const nextCard = cards.find(({ tier }) => tier === next);
  return { ladder, name, counts, count, tiers: cards, next: nextCard === undefined ? null : { tier: nextCard.tier, at: nextCard.at } };
}

async function tierCardOf(ladder: LadderId, { tier, name, count: at, earnedAt, rewards }: TierFacts, shown: Shown): Promise<TierCard> {
  const seen = earnedAt === null ? null : await seenKeyOf(shown.member, `tier:${ladder}:${tier}:${earnedAt}`);
  return { tier, name, at, earnedAt, seen, rewards: rewards.flatMap((reward) => rewardShown(reward, shown)) };
}

function rewardShown(reward: RewardFacts, shown: Shown): TierReward[] {
  if (reward.kind === "coins" && shown.coins) return [{ kind: "coins", coins: reward.coins }];
  if (reward.kind === "kudosEmoji" && shown.store) return [{ kind: "kudosEmoji", name: reward.item.name, art: reward.item.art }];
  return [];
}

async function timeZoneOf(ctx: QueryCtx, { workspace, user }: VerifiedMember): Promise<string> {
  const person = await lookup(ctx, workspace, user);
  return dayZoneOf(person?.kind === "member" ? person.timeZone : undefined);
}
