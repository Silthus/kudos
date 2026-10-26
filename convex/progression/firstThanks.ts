import type { QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import { firstDecidedOf, oldestAwardGivenBy, type AwardWithId } from "../engine/awards";
import { onboardingShownTo } from "../items/onboardingFlag";
import { onboardingQuestXpOf } from "../quests/onboarding";
import type { MemberId } from "../workspace/directory";
import { isRecorded, progressionWaitedFor } from "./effects";
import { xpToReach } from "./levels";
import { rewardOf, type RewardRecord } from "./rewards";

const firstThanksKey = "first-thanks";
const firstThanksCatalogueVersion = "onboarding-1";
const levelTheFirstThanksReaches = 2;

export type FirstThanksTopUp = { xp: number; decided: number };

export async function firstThanksTopUpFor(ctx: QueryCtx, { giver, message, at }: KudosGivenEvent, recorded: AwardWithId[], xpAfter: number): Promise<RewardRecord | null> {
  if (!(await recordsTheFirstAwardOf(ctx, giver, recorded))) return null;
  const xp = xpToReach(levelTheFirstThanksReaches) - (xpAfter - (await onboardingQuestXpOf(ctx, giver)));
  if (xp <= 0 || !(await onboardingShownTo(ctx, giver))) return null;
  return { member: giver, key: firstThanksKey, xp, coins: 0, item: null, catalogueVersion: firstThanksCatalogueVersion, at, cause: message };
}

export async function firstThanksTopUpPaidTo(ctx: QueryCtx, member: MemberId): Promise<FirstThanksTopUp | null> {
  const reward = await rewardOf(ctx, member, firstThanksKey);
  if (reward?.cause === undefined) return null;
  const decided = await firstDecidedOf(ctx, reward.cause);
  return decided === null ? null : { xp: reward.xp, decided };
}

export async function firstThanksAwaitsItsMoment(ctx: QueryCtx, member: MemberId, now: number): Promise<boolean> {
  if ((await firstThanksTopUpPaidTo(ctx, member)) !== null) return true;
  const oldest = await oldestAwardGivenBy(ctx, member);
  return oldest !== null && oldest.decided > now - progressionWaitedFor && !(await isRecorded(ctx, oldest.award, "giver")) && (await onboardingShownTo(ctx, member));
}

async function recordsTheFirstAwardOf(ctx: QueryCtx, giver: MemberId, recorded: AwardWithId[]): Promise<boolean> {
  const oldest = await oldestAwardGivenBy(ctx, giver);
  return recorded.some(({ award, giver: givenBy }) => givenBy === giver && award === oldest?.award);
}
