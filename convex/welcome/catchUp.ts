import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { memberDecision } from "../analytics/flags";
import { hasGivenAnAward, hasReceivedAnAward } from "../engine/awards";
import { hasHuggedBefore } from "../hugs/records";
import { onTheMondayPath } from "../quests/flag";
import { onboardingQuestsOf } from "../quests/onboarding";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catchUpWelcomeFlag } from "./catchUpFlag";
import { mondayWelcomeFor, type MondayWelcome } from "./mondayWelcome";
import { isWelcomed, recordWelcome } from "./welcome";

const catchUp = { path: "catch-up" } as const;

export async function catchUpWelcomeIn(ctx: MutationCtx, member: MemberId, at: number, { begun }: { begun: boolean }): Promise<MondayWelcome | null> {
  const caughtUp = begun ? await catchUpStillOnFor(ctx, member) : await welcomedToCatchUp(ctx, member, at);
  if (!caughtUp) return null;
  const { workspace } = await chatUserOf(ctx, member);
  return mondayWelcomeFor(ctx, workspace, member, catchUp, await onboardingQuestsOf(ctx, member, at));
}

export async function catchesUp(ctx: MutationCtx, { _id: member, kind }: Doc<"members">): Promise<boolean> {
  if (kind !== "member" || (await isWelcomed(ctx, member)) || !(await usedHedgeHug(ctx, member))) return false;
  return catchUpStillOnFor(ctx, member);
}

async function welcomedToCatchUp(ctx: MutationCtx, member: MemberId, at: number): Promise<boolean> {
  const row = await ctx.db.get(member);
  if (row === null || !(await catchesUp(ctx, row))) return false;
  await recordWelcome(ctx, member, catchUp, at);
  return true;
}

async function catchUpStillOnFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await onTheMondayPath(ctx, member)) && memberDecision(ctx, catchUpWelcomeFlag, member);
}

async function usedHedgeHug(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await hasHuggedBefore(ctx, member)) || (await hasGivenAnAward(ctx, member)) || (await hasReceivedAnAward(ctx, member));
}
