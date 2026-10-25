import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { analyticsIdOf } from "../analytics/person";
import { hugGivenEventValidator, kudosGivenEventValidator, questFinishedEventValidator, type HugGivenEvent, type KudosGivenEvent, type MemberWelcomedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { requestWelcome } from "../feedback/welcome";
import { hugOf } from "../hugs/records";
import { earnWelcomeItem } from "../items/welcome";
import { onboardingShownTo } from "../items/onboardingFlag";
import { saysWhy } from "../progression/gate";
import { rewardOf } from "../progression/rewards";
import { rewardKeyOf } from "../quests/crates";
import { mondayPathShownTo, onTheMondayPath } from "../quests/flag";
import { isPaidOnTheMondayPath } from "../quests/mondayCatalogue";
import { onboardingQuestsOf } from "../quests/onboarding";
import { startQuests } from "../quests/start";
import { chatUserOf, profileNameOf, type MemberId } from "../workspace/directory";
import { isTheFirstThanks } from "./firstThanks";
import type { MondayWelcomeCause } from "./mondayWelcome";
import type { WelcomedAs } from "./welcomedAs";

const membersPerPage = 100;

type Welcomed = Pick<MemberWelcomedEvent, "member" | "as">;

export const welcomeNewMembers = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }): Promise<void> => {
    const named = membersNamedIn(event);
    for (const welcomed of named.slice(from, from + membersPerPage)) await welcome(ctx, event, welcomed);
    if (from + membersPerPage < named.length) await ctx.scheduler.runAfter(0, internal.welcome.welcome.welcomeNewMembers, { event, from: from + membersPerPage });
  },
});

export const welcomeOnHug = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (event.first !== true) return;
    if (await onTheMondayPath(ctx, event.giver)) await welcomeOnTheMondayPath(ctx, event.giver, { path: "hug", hugged: event.message }, event.at);
    else if (await onboardingShownTo(ctx, event.giver)) await replyToTheFirstHug(ctx, event);
  },
});

export const welcomeOnFirstThanks = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { member, quest, at } }): Promise<void> => {
    if (!isTheFirstThanks(quest)) return;
    const finish = await rewardOf(ctx, member, rewardKeyOf(quest));
    if (finish === null || !isPaidOnTheMondayPath(finish) || !(await onTheMondayPath(ctx, member))) return;
    await welcomeOnTheMondayPath(ctx, member, { path: "thoughtful-given", ...(finish.cause && { kudos: finish.cause }) }, at);
  },
});

export async function welcomeOnTheMondayPath(ctx: MutationCtx, member: MemberId, cause: MondayWelcomeCause, at: number): Promise<void> {
  if (await isWelcomed(ctx, member)) return;
  await ctx.db.insert("welcomes", { member, path: cause.path });
  const { workspace, user } = await chatUserOf(ctx, member);
  await earnWelcomeItem(ctx, workspace, member, at);
  if (await mondayPathShownTo(ctx, member)) await startQuests(ctx, member, at);
  await analyticsIdOf(ctx, member);
  const journey = await onboardingQuestsOf(ctx, member, at);
  await ctx.scheduler.runAfter(0, internal.slack.welcome.deliverMondayWelcome, { workspace, user, member, cause, journey });
}

async function welcome(ctx: MutationCtx, event: KudosGivenEvent, { member, as }: Welcomed) {
  if (await isWelcomed(ctx, member)) return;
  if (await onTheMondayPath(ctx, member)) return welcomeTheThoughtfullyThanked(ctx, event, { member, as });
  const welcomed = await welcomedAs(ctx, event, as);
  await ctx.db.insert("welcomes", { member, welcomed });
  await requestWelcome(ctx, member, welcomed);
  await publish(ctx, { type: "memberWelcomed", workspace: event.workspace, member, as, at: Date.now() });
}

async function welcomeTheThoughtfullyThanked(ctx: MutationCtx, event: KudosGivenEvent, { member, as }: Welcomed) {
  if (as === "recipient" && saysWhy(event.annotations)) await welcomeOnTheMondayPath(ctx, member, { path: "thoughtful-received", giver: event.giver, kudos: event.message }, event.at);
}

async function replyToTheFirstHug(ctx: MutationCtx, event: HugGivenEvent) {
  const hug = await hugOf(ctx, event.message, event.giver);
  if (hug === null) return;
  const { workspace, user } = await chatUserOf(ctx, event.giver);
  const hugged = hug.author === undefined ? { kind: "peopleThanked" as const } : await authorHuggedOf(ctx, hug.author);
  await ctx.scheduler.runAfter(0, internal.slack.firstHugReply.deliverFirstHugReply, { workspace, user, conversation: event.message.conversation, hugged });
}

async function authorHuggedOf(ctx: MutationCtx, author: MemberId) {
  const name = await profileNameOf(ctx, author);
  return { kind: "author" as const, ...(name !== undefined && { name }) };
}

function membersNamedIn(event: KudosGivenEvent): Welcomed[] {
  return [{ member: event.giver, as: "giver" }, ...recipientsOf(event).map((member) => ({ member, as: "recipient" as const }))];
}

function recipientsOf(event: KudosGivenEvent): MemberId[] {
  return [...new Set(event.awards.map((award) => award.recipient).filter((recipient) => recipient !== event.giver))];
}

async function welcomedAs(ctx: MutationCtx, event: KudosGivenEvent, as: Welcomed["as"]): Promise<WelcomedAs> {
  if (as === "recipient") return { as, giver: await userOf(ctx, event.giver) };
  return { as, recipients: await Promise.all(recipientsOf(event).map((recipient) => userOf(ctx, recipient))) };
}

async function userOf(ctx: MutationCtx, member: MemberId) {
  return (await chatUserOf(ctx, member)).user;
}

export async function isWelcomed(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  const welcome = await ctx.db
    .query("welcomes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return welcome !== null;
}
