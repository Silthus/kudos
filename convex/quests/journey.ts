import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { memberLeftEventValidator, memberRejoinedEventValidator } from "../bus/events";
import { thankedAtOrBefore } from "../engine/awards";
import { teammatesOf, type MemberId } from "../workspace/directory";
import { onTheMondayPath } from "./flag";
import { finishSomeoneNewOnceEveryoneIsThanked, someoneNewWaitsOnTheMondayPath } from "./onboarding";

export const rewardValidator = v.object({ xp: v.number(), coins: v.number(), item: v.null() });

export type Reward = Infer<typeof rewardValidator>;

const membersPerRecheck = 100;

export const recheckSomeoneNew = internalMutation({
  args: { event: memberLeftEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }) => {
    const people = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", event.workspace))
      .paginate({ numItems: membersPerRecheck, cursor: cursor ?? null });
    for (const { _id: member, kind } of people.page) {
      if (kind === "member" && (await someoneNewWaitsOnTheMondayPath(ctx, member))) await recheckLater(ctx, event.workspace, member, event.at);
    }
    if (!people.isDone) await ctx.scheduler.runAfter(0, internal.quests.journey.recheckSomeoneNew, { event, cursor: people.continueCursor });
  },
});

export const recheckRejoined = internalMutation({
  args: { event: memberRejoinedEventValidator },
  handler: async (ctx, { event: { workspace, member, at } }) => {
    if (await someoneNewWaitsOnTheMondayPath(ctx, member)) await recheckLater(ctx, workspace, member, at);
  },
});

export const recheckSomeoneNewOf = internalMutation({
  args: { workspace: v.string(), member: v.id("members"), at: v.number() },
  handler: async (ctx, { workspace, member, at }) => {
    if (await onTheMondayPath(ctx, member)) await finishSomeoneNewOnceEveryoneIsThanked(ctx, workspace, member, at);
  },
});

async function recheckLater(ctx: MutationCtx, workspace: string, member: MemberId, at: number) {
  await ctx.scheduler.runAfter(0, internal.quests.journey.recheckSomeoneNewOf, { workspace, member, at });
}

export async function hasThankedEveryone(ctx: QueryCtx, workspace: string, member: MemberId, at: number): Promise<boolean> {
  for (const teammate of await teammatesOf(ctx, workspace, member)) if (!(await thankedAtOrBefore(ctx, member, teammate, at))) return false;
  return true;
}
