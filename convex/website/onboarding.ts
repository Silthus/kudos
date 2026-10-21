import { v } from "convex/values";
import { albumShownTo } from "../album/flag";
import { hasGivenAThoughtfulAward } from "../album/boards";
import { reportHowItWorksClosed } from "../analytics/isolatedUsage";
import { hasGivenAnAward } from "../engine/awards";
import { hasGivenAHug } from "../hugs/records";
import { newestTurnOf } from "../items/ledger";
import { onboardingShownTo } from "../items/onboardingFlag";
import { loopLessonIn, type LoopLesson } from "../items/welcome";
import { workspaceLink } from "../slack/workspaceLink";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { memberMutation } from "./memberMutation";
import type { VerifiedMember } from "./memberQuery";

export type HowItWorksCard = { slack: string; toLevelTwo: boolean };

export type GettingStarted = { hugged: boolean; thoughtful: boolean; turned: boolean; levelTwo: boolean };

export type Onboarding = { emojiHowTo?: LoopLesson; gettingStarted?: GettingStarted; howItWorks?: HowItWorksCard };

export type HowItWorksCloseAnswer = { kind: "closed" } | { kind: "refused" };

const levelTwo = 2;

export async function onboardingOf(ctx: QueryCtx, me: VerifiedMember, { level }: { level: number }): Promise<Onboarding> {
  if (!(await onboardingShownTo(ctx, me.member))) return {};
  return { emojiHowTo: await loopLessonIn(ctx, me.workspace), gettingStarted: await gettingStartedOf(ctx, me, level), ...(await howItWorksFor(ctx, me, level)) };
}

async function gettingStartedOf(ctx: QueryCtx, me: VerifiedMember, level: number): Promise<GettingStarted> {
  return {
    hugged: await hasGivenAHug(ctx, me.member),
    thoughtful: await hasGivenAThoughtfulAward(ctx, me.workspace, me.member),
    turned: (await newestTurnOf(ctx, me.member)) !== null,
    levelTwo: level >= levelTwo,
  };
}

async function howItWorksFor(ctx: QueryCtx, me: VerifiedMember, level: number): Promise<Pick<Onboarding, "howItWorks">> {
  if ((await hasGivenAnAward(ctx, me.member)) || (await closeOf(ctx, me.member)) !== null) return {};
  return { howItWorks: { slack: workspaceLink(me.workspace), toLevelTwo: level < levelTwo } };
}

export const closeHowItWorks = memberMutation({
  args: { triedSlack: v.boolean() },
  handler: async (ctx, me, _person, { triedSlack }): Promise<HowItWorksCloseAnswer> => {
    if (!(await albumShownTo(ctx, me.member)) || !(await onboardingShownTo(ctx, me.member))) return { kind: "refused" };
    if ((await closeOf(ctx, me.member)) === null) await storeTheClose(ctx, me, triedSlack);
    return { kind: "closed" };
  },
});

async function storeTheClose(ctx: MutationCtx, me: VerifiedMember, triedSlack: boolean) {
  const at = Date.now();
  await ctx.db.insert("howItWorksCloses", { member: me.member, triedSlack, at });
  await reportHowItWorksClosed(ctx, { workspace: me.workspace, member: me.member, triedSlack, at });
}

function closeOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("howItWorksCloses")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
