import type { QueryCtx } from "../_generated/server";
import { achievementFactsOf, type LadderFacts } from "../achievements/achievements";
import type { LadderId, TierId } from "../achievements/ladders";
import { dayZoneOf } from "../engine/allowance";
import { lookup } from "../workspace/directory";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { featurePageOf, unlockPathOf, type PageWaits } from "./unlockPath";

export type TierCard = { tier: TierId; name: string; at: number; earnedAt: number | null };

export type LadderCard = { ladder: LadderId; name: string; counts: string; count: number; tiers: TierCard[]; next: { tier: TierId; at: number } | null };

export type BookAnswer = { kind: "not-found" } | PageWaits | { kind: "book"; ladders: LadderCard[]; timeZone: string };

export const getBook = memberQuery(async (ctx, me): Promise<BookAnswer> => {
  const page = featurePageOf(await unlockPathOf(ctx, me), "book");
  if (page.kind === "off") return { kind: "not-found" };
  if (page.kind !== "open") return page;
  const facts = await achievementFactsOf(ctx, me.member);
  if (facts === null) return { kind: "not-found" };
  return { kind: "book", ladders: facts.ladders.map(ladderCardOf), timeZone: await timeZoneOf(ctx, me) };
});

function ladderCardOf({ ladder, name, counts, count, tiers, next }: LadderFacts): LadderCard {
  const cards = tiers.map(({ tier, name, count: at, earnedAt }) => ({ tier, name, at, earnedAt }));
  const nextCard = cards.find(({ tier }) => tier === next);
  return { ladder, name, counts, count, tiers: cards, next: nextCard === undefined ? null : { tier: nextCard.tier, at: nextCard.at } };
}

async function timeZoneOf(ctx: QueryCtx, { workspace, user }: VerifiedMember): Promise<string> {
  const person = await lookup(ctx, workspace, user);
  return dayZoneOf(person?.kind === "member" ? person.timeZone : undefined);
}
