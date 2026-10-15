import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent, type MemberWelcomedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { requestWelcome } from "../feedback/welcome";
import { chatUserOf, type MemberId } from "../workspace/directory";
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

async function welcome(ctx: MutationCtx, event: KudosGivenEvent, { member, as }: Welcomed) {
  if (await isWelcomed(ctx, member)) return;
  const welcomed = await welcomedAs(ctx, event, as);
  await ctx.db.insert("welcomes", { member, welcomed });
  await requestWelcome(ctx, member, welcomed);
  await publish(ctx, { type: "memberWelcomed", workspace: event.workspace, member, as, at: Date.now() });
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

async function isWelcomed(ctx: MutationCtx, member: MemberId) {
  const welcome = await ctx.db
    .query("welcomes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return welcome !== null;
}
