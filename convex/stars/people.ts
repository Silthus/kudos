import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { starGivenEventValidator } from "../bus/events";
import { recipientsPageOf } from "../engine/awards";
import { recordReward } from "../progression/progression";
import { isMember, type MemberId } from "../workspace/directory";
import { insertPaid, isPaid, starOf, type Star } from "./records";
import { starXp, starsCatalogueVersion } from "./xp";

const peopleAPage = 100;

export const payStarPeople = internalMutation({
  args: { event: starGivenEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }): Promise<void> => {
    const star = await starOf(ctx, event.message, event.giver);
    if (star === null) return;
    const { people, next } = await peoplePageOf(ctx, star, cursor ?? null);
    for (const person of people) await payPerson(ctx, star, person);
    if (next !== null) await ctx.scheduler.runAfter(0, internal.stars.people.payStarPeople, { event, cursor: next });
  },
});

type PeoplePage = { people: MemberId[]; next: string | null };

async function peoplePageOf(ctx: QueryCtx, star: Star, cursor: string | null): Promise<PeoplePage> {
  if (star.author !== undefined) return { people: [star.author], next: null };
  const { page, isDone, continueCursor } = await recipientsPageOf(ctx, star, { cursor, numItems: peopleAPage });
  return { people: page, next: isDone ? null : continueCursor };
}

async function payPerson(ctx: MutationCtx, star: Star, person: MemberId) {
  if (!(await isMember(ctx, person)) || (await isPaid(ctx, star, person))) return;
  await insertPaid(ctx, star, person);
  const key = `star:${star.giver}:${star.conversation}:${star.message}`;
  await recordReward(ctx, star.workspace, { member: person, key, xp: starXp, coins: 0, item: null, catalogueVersion: starsCatalogueVersion, at: star.at });
}
