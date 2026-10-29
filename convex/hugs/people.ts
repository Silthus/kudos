import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { hugGivenEventValidator } from "../bus/events";
import { publish } from "../bus/publish";
import { recordReward } from "../progression/progression";
import { isMember, type MemberId } from "../workspace/directory";
import { countReceivedOnTheMessage, insertPaid, isPaid, hugOf, hugPeoplePageOf, type Hug } from "./records";
import { countHugReceived, weekOfPersonAt } from "./weeks";
import { hugXp, hugsCatalogueVersion } from "./xp";

const peopleAPage = 100;

export const payHugPeople = internalMutation({
  args: { event: hugGivenEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }): Promise<void> => {
    const hug = await hugOf(ctx, event.message, event.giver);
    if (hug === null) return;
    const { people, next } = await hugPeoplePageOf(ctx, hug, cursor ?? null, peopleAPage);
    for (const person of people) await payPerson(ctx, hug, person);
    if (next !== null) await ctx.scheduler.runAfter(0, internal.hugs.people.payHugPeople, { event, cursor: next });
  },
});

async function payPerson(ctx: MutationCtx, hug: Hug, person: MemberId) {
  if (!(await isMember(ctx, person)) || (await isPaid(ctx, hug, person))) return;
  await insertPaid(ctx, hug, person);
  await countReceivedOnTheMessage(ctx, hug, person);
  await countHugReceived(ctx, hug, person);
  const key = `hug:${hug.giver}:${hug.conversation}:${hug.message}`;
  await recordReward(ctx, hug.workspace, { member: person, key, xp: hugXp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at: hug.at });
  await publishHugReceived(ctx, hug, person);
}

async function publishHugReceived(ctx: MutationCtx, { workspace, conversation, message, giver, at }: Hug, person: MemberId) {
  await publish(ctx, { type: "hugReceived", workspace, giver, person, message: { workspace, conversation, message }, at, week: await weekOfPersonAt(ctx, person, at) });
}
