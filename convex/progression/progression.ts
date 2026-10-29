import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, membersNamedIn, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";
import { awardsOfMessage } from "../engine/awards";
import type { DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { catalogue } from "./catalogue";
import type { Award, AwardWithId } from "../engine/awards";
import { awardsBefore, insertEffects, isRecorded } from "./effects";
import { firstThanksTopUpFor } from "./firstThanks";
import { baseXpOf, bonusPaidIn, coinsIn, effectsFor, noGiving, progress, rewarded, sideOf, standing, xpToNextLevel, type BonusLine, type Giving, type MemberProgress, type Progressed, type Standing } from "./progress";
import { receivingOf, receivingWeekOf, recordReceiving } from "./receiving";
import { insertReward, rewardOf, type AppliedReward, type RewardRecord, type StandingWithCoins } from "./rewards";
import { perksPayingIn } from "./skillTree";
import { balanceOf, credit, wholeCoins } from "../wallet/wallet";

const membersAPage = 100;

export const recordEffects = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }): Promise<void> => {
    const members = membersNamedIn(event);
    const next = from + membersAPage;
    for (const member of members.slice(from, next)) await recordEffectsOf(ctx, event, member);
    if (next < members.length) await ctx.scheduler.runAfter(0, internal.progression.progression.recordEffects, { event, from: next });
  },
});

async function recordEffectsOf(ctx: MutationCtx, event: KudosGivenEvent, member: MemberId) {
  const awards = await unrecordedAwardsOf(ctx, member, event.awards);
  if (awards.length === 0) return;
  const receivingWeek = await receivingWeekOf(ctx, event, member);
  const { state, effects, events } = progress(await progressOf(ctx, member), { ...event, awards }, catalogue, await givingOf(ctx, event, member), receivingOf(receivingWeek));
  await record(ctx, { state, effects });
  await recordReceiving(ctx, receivingWeek, event.giver, effects);
  await publish(ctx, { type: "xpRecorded", workspace: event.workspace, member, at: event.at });
  for (const levelReached of events) await publish(ctx, levelReached);
  if (member === event.giver) await topUpTheFirstThanks(ctx, event, awards, state.xp);
}

async function topUpTheFirstThanks(ctx: MutationCtx, event: KudosGivenEvent, recorded: AwardWithId[], xpAfter: number) {
  const topUp = await firstThanksTopUpFor(ctx, event, recorded, xpAfter);
  if (topUp !== null) await recordReward(ctx, event.workspace, topUp);
}

type GivenBy = { workspace: string; giver: MemberId; day: DayKey; awards: AwardWithId[] };

async function givingOf(ctx: QueryCtx, { workspace, giver, day, awards }: GivenBy, member: MemberId): Promise<Giving> {
  if (member !== giver || awards.length === 0) return noGiving;
  return { perks: await perksPayingIn(ctx, workspace, giver), earlier: await awardsBefore(ctx, giver, day, awards[0]!.award) };
}

export type GiverLines = { bonus: BonusLine[]; coins: number };

export async function giverLinesOf(ctx: QueryCtx, giver: MemberId, message: MessageRef): Promise<GiverLines> {
  const awards = await awardsOfMessage(ctx, message);
  const day = awards[0]?.day;
  if (day === undefined) return { bonus: [], coins: 0 };
  const giving = await givingOf(ctx, { workspace: message.workspace, giver, day, awards }, giver);
  const effects = effectsFor(giver, awards, { day, gate: null }, catalogue, giving);
  return { bonus: bonusPaidIn(effects), coins: coinsIn(effects) };
}

export function giverXpOf(awards: Pick<Award, "kudos">[]): number {
  return awards.reduce((sum, award) => sum + baseXpOf("giver", award, catalogue), 0);
}

export async function recordReward(ctx: MutationCtx, workspace: string, reward: RewardRecord): Promise<"recorded" | "already recorded"> {
  if ((await rewardOf(ctx, reward.member, reward.key)) !== null) return "already recorded";
  wholeCoins(reward.coins);
  await insertReward(ctx, reward);
  if (reward.held !== true) await applyReward(ctx, workspace, reward, reward.at);
  return "recorded";
}

export type Gain = Pick<RewardRecord, "member" | "xp" | "coins">;

export async function applyGain(ctx: MutationCtx, workspace: string, gain: Gain, at: number): Promise<AppliedReward> {
  const from = await standingWithCoinsOf(ctx, gain.member);
  await applyReward(ctx, workspace, gain, at);
  return { xp: gain.xp, coins: gain.coins, from, to: await standingWithCoinsOf(ctx, gain.member) };
}

async function applyReward(ctx: MutationCtx, workspace: string, { member, xp, coins }: Gain, at: number) {
  await credit(ctx, member, coins);
  const { state, events } = rewarded(await progressOf(ctx, member), { xp }, { workspace, at });
  await saveProgress(ctx, state);
  await publish(ctx, { type: "xpRecorded", workspace, member, at });
  for (const levelReached of events) await publish(ctx, levelReached);
}

async function standingWithCoinsOf(ctx: QueryCtx, member: MemberId): Promise<StandingWithCoins> {
  const { xp, level, skillPoints } = await standingOf(ctx, member);
  return { xp, level, coins: await balanceOf(ctx, member), skillPoints };
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
  await credit(ctx, state.member, coinsIn(effects));
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
