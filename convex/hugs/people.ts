import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { hugGivenEventValidator } from "../bus/events";
import { recipientsPageOf } from "../engine/awards";
import { recordReward } from "../progression/progression";
import { isMember, type MemberId } from "../workspace/directory";
import { countReceivedOnTheMessage, insertPaid, isPaid, hugOf, type Hug } from "./records";
import { countHugReceived } from "./weeks";
import { hugXp, hugsCatalogueVersion } from "./xp";

const peopleAPage = 100;

export const payHugPeople = internalMutation({
  args: { event: hugGivenEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }): Promise<void> => {
    const hug = await hugOf(ctx, event.message, event.giver);
    if (hug === null) return;
    const { people, next } = await peoplePageOf(ctx, hug, cursor ?? null);
    for (const person of people) await payPerson(ctx, hug, person);
    if (next !== null) await ctx.scheduler.runAfter(0, internal.hugs.people.payHugPeople, { event, cursor: next });
  },
});

type PeoplePage = { people: MemberId[]; next: string | null };

async function peoplePageOf(ctx: QueryCtx, hug: Hug, cursor: string | null): Promise<PeoplePage> {
  if (hug.author !== undefined) return { people: [hug.author], next: null };
  const { page, isDone, continueCursor } = await recipientsPageOf(ctx, hug, { cursor, numItems: peopleAPage });
  return { people: page, next: isDone ? null : continueCursor };
}

async function payPerson(ctx: MutationCtx, hug: Hug, person: MemberId) {
  if (!(await isMember(ctx, person)) || (await isPaid(ctx, hug, person))) return;
  await insertPaid(ctx, hug, person);
  await countReceivedOnTheMessage(ctx, hug, person);
  await countHugReceived(ctx, hug, person);
  const key = `hug:${hug.giver}:${hug.conversation}:${hug.message}`;
  await recordReward(ctx, hug.workspace, { member: person, key, xp: hugXp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at: hug.at });
}
