import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, membersNamedIn, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";
import { awardsOfMessage } from "../engine/awards";
import type { Annotations, MessageRef } from "../engine/messageEvent";
import { gateDecisionOf } from "./gate";
import { catalogue } from "./catalogue";
import type { Award, AwardWithId } from "../engine/awards";
import { insertEffects, isRecorded, thoughtfulAwardsBefore } from "./effects";
import { baseXpOf, bonusPaidIn, effectsFor, noGiving, progress, rewarded, sideOf, standing, xpToNextLevel, type BonusLine, type Giving, type MemberProgress, type Progressed, type Standing } from "./progress";
import { insertReward, rewardOf, type RewardRecord } from "./rewards";
import { perksPayingIn } from "./skillTree";

export const recordEffects = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    for (const member of membersNamedIn(event)) {
      const awards = await unrecordedAwardsOf(ctx, member, event.awards);
      if (awards.length === 0) continue;
      const { state, effects, events } = progress(await progressOf(ctx, member), { ...event, awards }, catalogue, await givingOf(ctx, event, member));
      await record(ctx, { state, effects });
      await publish(ctx, { type: "xpRecorded", workspace: event.workspace, member, at: event.at });
      for (const levelReached of events) await publish(ctx, levelReached);
    }
  },
});

async function givingOf(ctx: QueryCtx, { workspace, giver, day, awards }: Pick<KudosGivenEvent, "workspace" | "giver" | "day" | "awards">, member: MemberId): Promise<Giving> {
  if (member !== giver || awards.length === 0) return noGiving;
  const perks = await perksPayingIn(ctx, workspace, giver);
  if (perks.length === 0) return noGiving;
  return { perks, earlier: await thoughtfulAwardsBefore(ctx, giver, day, awards[0]!.award) };
}

export async function giverBonusOf(ctx: QueryCtx, giver: MemberId, message: MessageRef, annotations: Annotations): Promise<BonusLine[]> {
  const awards = await awardsOfMessage(ctx, message);
  const day = awards[0]?.day;
  if (day === undefined) return [];
  const giving = await givingOf(ctx, { workspace: message.workspace, giver, day, awards }, giver);
  return bonusPaidIn(effectsFor(giver, awards, { day, gate: gateDecisionOf(annotations) }, catalogue, giving));
}

export function giverXpOf(awards: Pick<Award, "kudos">[]): number {
  return awards.reduce((sum, award) => sum + baseXpOf("giver", award, catalogue), 0);
}

export async function recordReward(ctx: MutationCtx, workspace: string, reward: RewardRecord): Promise<"recorded" | "already recorded"> {
  const { member, at } = reward;
  if ((await rewardOf(ctx, member, reward.key)) !== null) return "already recorded";
  await insertReward(ctx, reward);
  const { state, events } = rewarded(await progressOf(ctx, member), reward, { workspace, at });
  await saveProgress(ctx, state);
  await publish(ctx, { type: "xpRecorded", workspace, member, at });
  for (const levelReached of events) await publish(ctx, levelReached);
  return "recorded";
}

export async function unrecordedAwardsOf<A extends AwardWithId>(ctx: QueryCtx, member: MemberId, awards: A[]): Promise<A[]> {
  const unrecorded: A[] = [];
  for (const award of awards) {
    const side = sideOf(member, award);
    if (side !== null && !(await isRecorded(ctx, award.award, side))) unrecorded.push(award);
  }
  return unrecorded;
}

export async function record(ctx: MutationCtx, { state, effects }: Pick<Progressed, "state" | "effects">) {
  await insertEffects(ctx, effects);
  await saveProgress(ctx, state);
}

export async function standingOf(ctx: QueryCtx, member: MemberId): Promise<Standing> {
  return standing(await progressOf(ctx, member));
}

export type ProgressionHome = Standing & { xpToNextLevel: number };

export async function progressionHomeOf(ctx: QueryCtx, member: MemberId): Promise<ProgressionHome> {
  const memberStanding = await standingOf(ctx, member);
  return { ...memberStanding, xpToNextLevel: xpToNextLevel(memberStanding) };
}

export async function spendSkillPoints(ctx: MutationCtx, member: MemberId, points: number) {
  const state = await progressOf(ctx, member);
  await saveProgress(ctx, { ...state, pointsSpent: state.pointsSpent + points });
}

export async function progressOf(ctx: QueryCtx, member: MemberId): Promise<MemberProgress> {
  const row = await progressRow(ctx, member);
  return { member, xp: row?.xp ?? 0, pointsSpent: row?.pointsSpent ?? 0 };
}

async function saveProgress(ctx: MutationCtx, { member, xp, pointsSpent }: MemberProgress) {
  const row = await progressRow(ctx, member);
  if (row === null) await ctx.db.insert("memberProgress", { member, xp, pointsSpent });
  else await ctx.db.patch(row._id, { xp, pointsSpent });
}

function progressRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("memberProgress")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
