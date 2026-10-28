import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { unlockOpenedEventValidator, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { allowanceDay, allowanceLeft } from "../engine/allowance";
import { awardIdValidator, lastThankedBefore, lastThankedSince } from "../engine/awards";
import { republish } from "../feedback/homes";
import { notifyWeeklyQuestFinished } from "../feedback/notify";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf } from "../progression/rewards";
import { openedAtOf } from "../unlocks/unlocks";
import { chatUserOf, teammatesOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { crateOpenedAt, crateOpeningOf, rewardKeyOf, waitsUnopened, weeklyQuestOfRewardKey } from "./crates";
import { finishMondayQuest, finishQuest } from "./finish";
import { onTheMondayPath, questsLiveFor, type QuestPath } from "./flag";
import { rewardValidator, type Reward } from "./journey";
import { isPaidOnTheMondayPath } from "./mondayCatalogue";
import { onboardingFinishedAt } from "./onboarding";
import { pendingWeeklyCratesBefore } from "./pendingCrates";
import { feasibility, feasibleBecauseValidator, mondayQuestPool, questIdValidator, questOf, questPool, withoutFullStop, type DrawFacts, type FeasibleBecause, type PoolQuest, type QuestId, type QuestPool, type Recipient } from "./pool";
import { counts, isRecipient, notThankedForMs, progressUnitOf, questProgress, type CountedAward, type MovedQuest, type QuestAward } from "./progress";
import { drawRank } from "./rank";
import { questStartOf } from "./start";
import type { WeeklyQuest } from "./step";
import { daysLeftInWeek, weekKeyOf, weekKeyOfDay, weekStartOf, type WeekKey } from "./week";

const questsPerWeek = 3;

const slotValidator = v.object({
  slot: v.number(),
  quest: questIdValidator,
  reward: rewardValidator,
  catalogueVersion: v.string(),
  feasibleBecause: feasibleBecauseValidator,
});

export const questDrawValidator = v.object({ member: v.id("members"), week: v.string(), drawnAt: v.number(), slots: v.array(slotValidator) });

export const questProgressValidator = v.object({
  member: v.id("members"),
  week: v.string(),
  slot: v.number(),
  quest: questIdValidator,
  award: awardIdValidator,
  recipient: v.id("members"),
  day: v.string(),
  at: v.number(),
});

export const questSwapValidator = v.object({ member: v.id("members"), week: v.string(), swappedAt: v.number(), replaced: questIdValidator, swappedIn: slotValidator });

type Slot = Infer<typeof slotValidator>;

type Draw = Infer<typeof questDrawValidator>;

type Swap = Infer<typeof questSwapValidator>;

type FeasibleQuest = { quest: PoolQuest; feasibleBecause: FeasibleBecause };

type DrawSchedule = { opensAt: number; pool: QuestPool };

export type WeeklySlot = Slot & { goal: string; progress: number; target: number; finishedAt: number | null; openedAt: number | null; waiting: boolean };

export type QuestSwap = { slot: number; replaced: QuestId; quest: QuestId; swappedAt: number };

export type UnopenedCrate = { crate: WeeklyQuest; week: WeekKey; goal: string; reward: Reward; finishedAt: number; waiting: boolean };

export type DrawnWeek = Omit<WeeklyQuests, "slots"> & { slots: Array<WeeklySlot & { crate: WeeklyQuest }> };

export type WeeklyQuests = { week: WeekKey; drawnAt: number; slots: WeeklySlot[]; swap: QuestSwap | null; swapAvailable: boolean };

export const drawWeeklyQuests = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (event.feature !== "quests" || (await onTheMondayPath(ctx, event.member)) || !(await questsLiveFor(ctx, event.member))) return;
    if ((await drawFor(ctx, event.member, Date.now(), questPool)) === "drawn") await republish(ctx, event.member);
  },
});

export type FinishedWeeklyQuest = { crate: WeeklyQuest; goal: string; reward: Slot["reward"] };

export type AdvancedWeeklyQuests = { finished: FinishedWeeklyQuest[]; moved: MovedQuest[] };

type SlotAdvance = { kind: "unchanged" } | { kind: "advanced"; done: number } | { kind: "finished" };

export async function advanceWeeklyQuests(ctx: MutationCtx, event: KudosGivenEvent, path: QuestPath): Promise<AdvancedWeeklyQuests> {
  let shownChanged = (await drawWhenDue(ctx, event.giver, event.at)) === "drawn";
  const finished: FinishedWeeklyQuest[] = [];
  const moved: MovedQuest[] = [];
  const draw = await drawOf(ctx, event.giver, weekKeyOfDay(event.day));
  if (draw !== null && isMondayDraw(draw) === (path === "monday")) {
    const swap = await swapOf(ctx, draw.member, draw.week);
    const open = (await unfinishedSlotsOf(ctx, draw, slotsOf(draw, swap))).filter((slot) => event.at >= countsFrom(draw, swap, slot));
    const awards = open.length === 0 ? [] : await questAwardsOf(ctx, event);
    for (const slot of open) {
      const advanced = await advanceSlot(ctx, event, draw, slot, awards);
      if (advanced.kind === "finished") finished.push({ crate: weeklyQuest(draw.week, slot), goal: questOf(slot.quest).goal, reward: slot.reward });
      if (advanced.kind === "advanced") moved.push(movedQuestOf(slot, advanced.done));
      shownChanged = advanced.kind !== "unchanged" || shownChanged;
    }
  }
  if (shownChanged) await republish(ctx, event.giver);
  return { finished, moved };
}

function movedQuestOf({ quest }: Slot, done: number): MovedQuest {
  const pooled = questOf(quest);
  return { goal: withoutFullStop(pooled.goal), progress: { done, of: pooled.progress.target, unit: progressUnitOf(pooled) } };
}

export const drawNewWeek = internalMutation({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<void> => {
    if (!(await onTheMondayPath(ctx, member)) && !(await questsLiveFor(ctx, member))) return;
    if ((await drawWhenDue(ctx, member, Date.now())) === "drawn") await republish(ctx, member);
  },
});

export async function thisWeeksQuestsOf(ctx: MutationCtx, member: MemberId, at: number): Promise<WeeklyQuests | null> {
  await drawWhenDue(ctx, member, at);
  return weeklyQuestsOf(ctx, member, at);
}

export async function awaitsThisWeeksDraw(ctx: QueryCtx, { _id: member, timeZone }: Doc<"members">, at: number): Promise<boolean> {
  return (await drawScheduleOf(ctx, member)) !== null && (await drawOf(ctx, member, weekKeyOf(at, timeZone))) === null;
}

export async function weeklyQuestsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<WeeklyQuests | null> {
  const draw = await thisWeeksDrawOf(ctx, member, at);
  if (draw === null) return null;
  const { week, drawnAt } = draw;
  const swap = await swapOf(ctx, member, week);
  const slots = await weeklySlotsOf(ctx, draw, swap);
  return { week, drawnAt, slots, swap: swap === null ? null : questSwapOf(swap), swapAvailable: await swapAvailableIn(ctx, draw, swap, slots, at) };
}

export async function drawnWeekOf(ctx: QueryCtx, member: MemberId, at: number): Promise<DrawnWeek | null> {
  const draw = await thisWeeksDrawOf(ctx, member, at);
  if (draw === null) return null;
  const { week, drawnAt } = draw;
  const swap = await swapOf(ctx, member, week);
  const slots = await weeklySlotsOf(ctx, draw, swap);
  const swapAvailable = await swapAvailableIn(ctx, draw, swap, slots, at);
  return { week, drawnAt, slots: slots.map((slot) => ({ ...slot, crate: weeklyQuest(week, slot) })), swap: swap === null ? null : questSwapOf(swap), swapAvailable };
}

export async function swappedSlotIn(ctx: QueryCtx, member: MemberId, week: WeekKey): Promise<number | null> {
  return (await swapOf(ctx, member, week))?.swappedIn.slot ?? null;
}

async function swapAvailableIn(ctx: QueryCtx, draw: Draw, swap: Swap | null, slots: WeeklySlot[], at: number): Promise<boolean> {
  if (isMondayDraw(draw) || swap !== null || slots.every(({ finishedAt }) => finishedAt !== null)) return false;
  return (await replacementForAnyoneIn(ctx, draw, at)) || (await replacementFor(ctx, draw, at)) !== null;
}

async function replacementForAnyoneIn(ctx: QueryCtx, { member, slots }: Draw, at: number): Promise<boolean> {
  const facts = await factsWithoutHistory(ctx, member, at);
  return questPool.quests.some((quest) => quest.progress.given.to === "anyone" && !slots.some((drawn) => drawn.quest === quest.quest) && feasibility(quest, facts) !== null);
}

async function thisWeeksDrawOf(ctx: QueryCtx, member: MemberId, at: number) {
  return drawOf(ctx, member, weekKeyOf(at, await timeZoneOf(ctx, member)));
}

async function weeklySlotsOf(ctx: QueryCtx, draw: Draw, swap: Swap | null): Promise<WeeklySlot[]> {
  const slots: WeeklySlot[] = [];
  for (const slot of slotsOf(draw, swap)) slots.push(await weeklySlotOf(ctx, draw, slot));
  return slots;
}

export async function unopenedCratesOf(ctx: QueryCtx, member: MemberId, at: number): Promise<UnopenedCrate[]> {
  const thisWeek = weekKeyOf(at, await timeZoneOf(ctx, member));
  const unopened: UnopenedCrate[] = [];
  for (const { key } of await pendingWeeklyCratesBefore(ctx, member, thisWeek)) {
    const crate = weeklyQuestOfRewardKey(key)!;
    const { xp, coins, at: finishedAt, held } = (await rewardOf(ctx, member, key))!;
    unopened.push({ crate, week: crate.week, goal: await weeklyGoalOf(ctx, member, crate), reward: { xp, coins, item: null }, finishedAt, waiting: held === true });
  }
  return unopened.sort((one, other) => one.finishedAt - other.finishedAt);
}

export async function weeklyGoalOf(ctx: QueryCtx, member: MemberId, { week, slot }: WeeklyQuest): Promise<string> {
  const draw = (await drawOf(ctx, member, week))!;
  const finished = slotsOf(draw, await swapOf(ctx, member, week)).find((drawn) => drawn.slot === slot)!;
  return questOf(finished.quest).goal;
}

export async function rerollQuest(ctx: MutationCtx, member: MemberId, { week, slot }: WeeklyQuest): Promise<"swapped" | "refused"> {
  if (!(await questsLiveFor(ctx, member))) return "refused";
  const { workspace } = await chatUserOf(ctx, member);
  const at = Date.now();
  await drawWhenDue(ctx, member, at);
  if (week !== weekKeyOf(at, await timeZoneOf(ctx, member))) return "refused";
  const draw = await drawOf(ctx, member, week);
  if (draw === null || isMondayDraw(draw) || (await swapOf(ctx, member, week)) !== null) return "refused";
  const replaced = draw.slots.find((drawn) => drawn.slot === slot);
  if (replaced === undefined || (await isFinished(ctx, draw, replaced))) return "refused";
  const replacement = await replacementFor(ctx, draw, at);
  if (replacement === null) return "refused";
  await ctx.db.insert("questSwaps", { member, week, swappedAt: at, replaced: replaced.quest, swappedIn: slotOf(slot, questPool, replacement) });
  await publish(ctx, { type: "questSwapped", workspace, member, week, replaced: replaced.quest, swappedIn: replacement.quest.quest, at });
  return "swapped";
}

export async function poolQuestOf(ctx: QueryCtx, member: MemberId, { week, slot }: WeeklyQuest): Promise<QuestId | null> {
  const draw = await drawOf(ctx, member, week);
  if (draw === null) return null;
  return slotsOf(draw, await swapOf(ctx, member, week)).find((drawn) => drawn.slot === slot)?.quest ?? null;
}

async function replacementFor(ctx: QueryCtx, { member, week, slots }: Draw, at: number): Promise<FeasibleQuest | null> {
  const drawn = (candidate: FeasibleQuest) => slots.some(({ quest }) => quest === candidate.quest.quest);
  return rankedFeasible(member, week, questPool, await drawFactsOf(ctx, member, at)).find((candidate) => !drawn(candidate)) ?? null;
}

function slotsOf({ slots }: Draw, swap: Swap | null): Slot[] {
  return slots.map((slot) => (swap?.swappedIn.slot === slot.slot ? swap.swappedIn : slot));
}

function countsFrom({ drawnAt }: Draw, swap: Swap | null, { slot }: Slot): number {
  return swap?.swappedIn.slot === slot ? swap.swappedAt : drawnAt;
}

function questSwapOf({ swappedIn, replaced, swappedAt }: Swap): QuestSwap {
  return { slot: swappedIn.slot, replaced, quest: swappedIn.quest, swappedAt };
}

async function weeklySlotOf(ctx: QueryCtx, { member, week }: Draw, slot: Slot): Promise<WeeklySlot> {
  const pooled = questOf(slot.quest);
  const key = rewardKeyOf(weeklyQuest(week, slot));
  const finish = await rewardOf(ctx, member, key);
  const opening = await crateOpeningOf(ctx, member, key);
  const progress = questProgress(pooled, await countedFor(ctx, member, week, slot));
  return { ...slot, goal: pooled.goal, progress, target: pooled.progress.target, finishedAt: finish?.at ?? null, openedAt: crateOpenedAt(finish, opening), waiting: waitsUnopened(finish, opening) };
}

async function unfinishedSlotsOf(ctx: QueryCtx, draw: Draw, slots: Slot[]): Promise<Slot[]> {
  const open: Slot[] = [];
  for (const slot of slots) if (!(await isFinished(ctx, draw, slot))) open.push(slot);
  return open;
}

async function isFinished(ctx: QueryCtx, { member, week }: Draw, slot: Slot): Promise<boolean> {
  return (await rewardOf(ctx, member, rewardKeyOf(weeklyQuest(week, slot)))) !== null;
}

async function advanceSlot(ctx: MutationCtx, event: KudosGivenEvent, { member, week }: Draw, slot: Slot, awards: QuestAward[]): Promise<SlotAdvance> {
  const quest = weeklyQuest(week, slot);
  const pooled = questOf(slot.quest);
  const counted = await countedFor(ctx, member, week, slot);
  const fresh = awards.filter((award) => counts(pooled, award) && !counted.some((earlier) => earlier.award === award.award));
  if (fresh.length === 0) return { kind: "unchanged" };
  for (const { award, recipient, day, at } of fresh) await ctx.db.insert("questProgress", { member, week, slot: slot.slot, quest: slot.quest, award, recipient, day, at });
  const before = questProgress(pooled, counted);
  const after = questProgress(pooled, [...counted, ...fresh]);
  if (after === pooled.progress.target && (await finishDrawnQuest(ctx, event, member, quest, slot))) return { kind: "finished" };
  return after === before ? { kind: "unchanged" } : { kind: "advanced", done: after };
}

async function finishDrawnQuest(ctx: MutationCtx, { workspace, at, message }: KudosGivenEvent, member: MemberId, quest: WeeklyQuest, slot: Slot): Promise<boolean> {
  const promised = { ...slot, poolQuest: slot.quest };
  if (isPaidOnTheMondayPath(slot)) return finishMondayQuest(ctx, workspace, member, quest, promised, at, message);
  if (!(await finishQuest(ctx, workspace, member, quest, promised, at, message))) return false;
  await notifyWeeklyQuestFinished(ctx, member, quest, questOf(slot.quest).goal, slot.reward.xp, message);
  return true;
}

export function isMondayDraw({ slots }: { slots: Array<{ catalogueVersion: string }> }): boolean {
  return slots.some(isPaidOnTheMondayPath);
}

async function questAwardsOf(ctx: QueryCtx, { awards, annotations, day, at }: KudosGivenEvent): Promise<QuestAward[]> {
  const saysWhy = gateDecisionOf(annotations)?.thoughtful === true;
  const lastThanked = await lastThankedBefore(ctx, awards);
  return awards.flatMap(({ award, recipient }) => {
    const before = lastThanked.get(award);
    return before === undefined ? [] : [{ award, recipient, day, at, saysWhy, lastThankedBefore: before }];
  });
}

async function countedFor(ctx: QueryCtx, member: MemberId, week: WeekKey, { slot, quest }: Slot): Promise<CountedAward[]> {
  const rows = await ctx.db
    .query("questProgress")
    .withIndex("by_member_week_slot", (q) => q.eq("member", member).eq("week", week).eq("slot", slot))
    .collect();
  return rows.filter((row) => row.quest === quest);
}

function weeklyQuest(week: WeekKey, { slot }: Slot): WeeklyQuest {
  return { kind: "weekly", week, slot };
}

export async function drawFactsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<DrawFacts> {
  return factsWithTheDaySpent(ctx, member, at, await lastThankedAsOf(ctx, member, at, at));
}

function factsWithoutHistory(ctx: QueryCtx, member: MemberId, at: number): Promise<DrawFacts> {
  return factsWithTheDaySpent(ctx, member, at, new Map());
}

async function factsWithTheDaySpent(ctx: QueryCtx, member: MemberId, at: number, lastThanked: LastThanked): Promise<DrawFacts> {
  const facts = await factsWithTheDayUnspent(ctx, member, at, lastThanked);
  const kudosLeftToday = await allowanceLeft(ctx, member, allowanceDay(at, await timeZoneOf(ctx, member)), facts.dailyAllowance);
  return { ...facts, kudosLeftToday };
}

async function factsAtTheStartOf(ctx: QueryCtx, member: MemberId, weekStart: number): Promise<DrawFacts> {
  return factsWithTheDayUnspent(ctx, member, weekStart, await lastThankedAsOf(ctx, member, weekStart, weekStart - 1));
}

type LastThanked = Map<MemberId, number>;

function lastThankedAsOf(ctx: QueryCtx, member: MemberId, at: number, atOrBefore: number): Promise<LastThanked> {
  return lastThankedSince(ctx, member, at - notThankedForMs, atOrBefore);
}

async function factsWithTheDayUnspent(ctx: QueryCtx, member: MemberId, at: number, lastThanked: LastThanked): Promise<DrawFacts> {
  const { workspace } = await chatUserOf(ctx, member);
  const { baseAllowance } = await settingsOf(ctx, workspace);
  const teammates = await teammatesOf(ctx, workspace, member);
  const left = (to: Recipient) => teammates.filter((teammate) => isRecipient(to, lastThanked.get(teammate) ?? null, at)).length;
  return {
    daysLeft: daysLeftInWeek(at, await timeZoneOf(ctx, member)),
    kudosLeftToday: baseAllowance,
    dailyAllowance: baseAllowance,
    peopleLeft: { anyone: left("anyone"), "someone-new": left("someone-new"), "someone-not-thanked-in-30-days": left("someone-not-thanked-in-30-days") },
  };
}

async function drawWhenDue(ctx: MutationCtx, member: MemberId, at: number): Promise<"drawn" | "nothing to draw"> {
  const schedule = await drawScheduleOf(ctx, member);
  if (schedule === null) return "nothing to draw";
  const { opensAt, pool } = schedule;
  const timeZone = await timeZoneOf(ctx, member);
  const week = weekKeyOf(at, timeZone);
  if (weekKeyOf(opensAt, timeZone) === week) return drawFor(ctx, member, Math.max(at, opensAt), pool);
  return at < opensAt ? "nothing to draw" : drawFor(ctx, member, weekStartOf(week, timeZone), pool, factsAtTheStartOf);
}

async function drawScheduleOf(ctx: QueryCtx, member: MemberId): Promise<DrawSchedule | null> {
  if (await onTheMondayPath(ctx, member)) {
    const opensAt = await mondayDrawsOpenAt(ctx, member);
    return opensAt === null ? null : { opensAt, pool: mondayQuestPool };
  }
  const openedAt = await openedAtOf(ctx, member, "quests");
  return openedAt === null ? null : { opensAt: openedAt, pool: questPool };
}

async function mondayDrawsOpenAt(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  const start = await questStartOf(ctx, member);
  const onboardingFinished = start === null ? null : await onboardingFinishedAt(ctx, member);
  return start === null || onboardingFinished === null ? null : Math.max(start, onboardingFinished + 1);
}

async function drawFor(ctx: MutationCtx, member: MemberId, at: number, pool: QuestPool, factsOf = drawFactsOf): Promise<"drawn" | "nothing to draw"> {
  const week = weekKeyOf(at, await timeZoneOf(ctx, member));
  if ((await drawOf(ctx, member, week)) !== null) return "nothing to draw";
  const slots = drawFrom(member, week, pool, await factsOf(ctx, member, at));
  if (slots.length === 0) return "nothing to draw";
  await ctx.db.insert("questDraws", { member, week, drawnAt: at, slots });
  const { workspace } = await chatUserOf(ctx, member);
  await publish(ctx, { type: "questsDrawn", workspace, member, week, quests: slots.map(({ quest }) => quest), at });
  return "drawn";
}

function drawFrom(member: MemberId, week: WeekKey, pool: QuestPool, facts: DrawFacts): Slot[] {
  return rankedFeasible(member, week, pool, facts)
    .slice(0, questsPerWeek)
    .map((feasible, slot) => slotOf(slot, pool, feasible));
}

function rankedFeasible(member: MemberId, week: WeekKey, pool: QuestPool, facts: DrawFacts): FeasibleQuest[] {
  const ranked = [...pool.quests].sort((one, other) => rankOf(member, week, one) - rankOf(member, week, other));
  return ranked.flatMap((quest) => {
    const feasibleBecause = feasibility(quest, facts);
    return feasibleBecause === null ? [] : [{ quest, feasibleBecause }];
  });
}

function slotOf(slot: number, { version }: QuestPool, { quest: { quest, reward }, feasibleBecause }: FeasibleQuest): Slot {
  return { slot, quest, reward, catalogueVersion: version, feasibleBecause };
}

function rankOf(member: MemberId, week: WeekKey, { quest }: PoolQuest) {
  return drawRank(`${member}:${week}:${quest}`);
}

async function timeZoneOf(ctx: QueryCtx, member: MemberId) {
  return (await ctx.db.get(member))?.timeZone;
}

function drawOf(ctx: QueryCtx, member: MemberId, week: WeekKey) {
  return ctx.db
    .query("questDraws")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
}

function swapOf(ctx: QueryCtx, member: MemberId, week: WeekKey) {
  return ctx.db
    .query("questSwaps")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
}
