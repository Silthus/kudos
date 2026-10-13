import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, unlockOpenedEventValidator, type KudosGivenEvent } from "../bus/events";
import { allowanceDay, allowanceLeft } from "../engine/allowance";
import { awardIdValidator, lastThankedBefore, lastThankedBy } from "../engine/awards";
import { republish } from "../feedback/homes";
import { notifyWeeklyQuestFinished } from "../feedback/notify";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { crateOpeningOf, rewardKeyOf } from "./crates";
import { finishQuest } from "./finish";
import { questsApplyIn } from "./flag";
import { rewardValidator } from "./journey";
import { feasibility, feasibleBecauseValidator, questIdValidator, questOf, questPool, type DrawFacts, type FeasibleBecause, type PoolQuest, type QuestId, type Recipient } from "./pool";
import { counts, isRecipient, questProgress, type CountedAward, type QuestAward } from "./progress";
import type { WeeklyQuest } from "./step";
import { daysLeftInWeek, weekKeyOf, weekKeyOfDay, type WeekKey } from "./week";

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

export type WeeklySlot = Slot & { goal: string; progress: number; target: number; finishedAt: number | null; openedAt: number | null };

export type QuestSwap = { slot: number; replaced: QuestId; quest: QuestId; swappedAt: number };

export type WeeklyQuests = { week: WeekKey; drawnAt: number; slots: WeeklySlot[]; swap: QuestSwap | null; swapAvailable: boolean };

export const drawWeeklyQuests = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (event.feature !== "quests" || !(await questsApplyIn(ctx, event.workspace))) return;
    if ((await drawFor(ctx, event.member, Date.now())) === "drawn") await republish(ctx, event.member);
  },
});

export const advanceWeeklyQuests = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (!(await questsApplyIn(ctx, event.workspace))) return;
    const draw = await drawOf(ctx, event.giver, weekKeyOfDay(event.day));
    if (draw === null) return;
    const swap = await swapOf(ctx, draw.member, draw.week);
    const open = (await unfinishedSlotsOf(ctx, draw, slotsOf(draw, swap))).filter((slot) => event.at >= countsFrom(draw, swap, slot));
    if (open.length === 0) return;
    const awards = await questAwardsOf(ctx, event);
    let shownChanged = false;
    for (const slot of open) shownChanged = (await advanceSlot(ctx, event, draw, slot, awards)) || shownChanged;
    if (shownChanged) await republish(ctx, event.giver);
  },
});

export async function weeklyQuestsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<WeeklyQuests | null> {
  const draw = await drawOf(ctx, member, weekKeyOf(at, await timeZoneOf(ctx, member)));
  if (draw === null) return null;
  const { week, drawnAt } = draw;
  const swap = await swapOf(ctx, member, week);
  const slots: WeeklySlot[] = [];
  for (const slot of slotsOf(draw, swap)) slots.push(await weeklySlotOf(ctx, draw, slot));
  const swapAvailable = swap === null && slots.some(({ finishedAt }) => finishedAt === null) && (await replacementFor(ctx, draw, at)) !== null;
  return { week, drawnAt, slots, swap: swap === null ? null : questSwapOf(swap), swapAvailable };
}

export async function rerollQuest(ctx: MutationCtx, member: MemberId, { week, slot }: WeeklyQuest): Promise<"swapped" | "refused"> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await questsApplyIn(ctx, workspace))) return "refused";
  const at = Date.now();
  if (week !== weekKeyOf(at, await timeZoneOf(ctx, member))) return "refused";
  const draw = await drawOf(ctx, member, week);
  if (draw === null || (await swapOf(ctx, member, week)) !== null) return "refused";
  const replaced = draw.slots.find((drawn) => drawn.slot === slot);
  if (replaced === undefined || (await isFinished(ctx, draw, replaced))) return "refused";
  const replacement = await replacementFor(ctx, draw, at);
  if (replacement === null) return "refused";
  await ctx.db.insert("questSwaps", { member, week, swappedAt: at, replaced: replaced.quest, swappedIn: slotOf(slot, replacement) });
  return "swapped";
}

async function replacementFor(ctx: QueryCtx, { member, week, slots }: Draw, at: number): Promise<FeasibleQuest | null> {
  const drawn = (candidate: FeasibleQuest) => slots.some(({ quest }) => quest === candidate.quest.quest);
  return rankedFeasible(member, week, await drawFactsOf(ctx, member, at)).find((candidate) => !drawn(candidate)) ?? null;
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
  return { ...slot, goal: pooled.goal, progress, target: pooled.progress.target, finishedAt: finish?.at ?? null, openedAt: opening?.at ?? null };
}

async function unfinishedSlotsOf(ctx: QueryCtx, draw: Draw, slots: Slot[]): Promise<Slot[]> {
  const open: Slot[] = [];
  for (const slot of slots) if (!(await isFinished(ctx, draw, slot))) open.push(slot);
  return open;
}

async function isFinished(ctx: QueryCtx, { member, week }: Draw, slot: Slot): Promise<boolean> {
  return (await rewardOf(ctx, member, rewardKeyOf(weeklyQuest(week, slot)))) !== null;
}

async function advanceSlot(ctx: MutationCtx, event: KudosGivenEvent, { member, week }: Draw, slot: Slot, awards: QuestAward[]): Promise<boolean> {
  const quest = weeklyQuest(week, slot);
  const pooled = questOf(slot.quest);
  const counted = await countedFor(ctx, member, week, slot);
  const fresh = awards.filter((award) => counts(pooled, award) && !counted.some((earlier) => earlier.award === award.award));
  if (fresh.length === 0) return false;
  for (const { award, recipient, day, at } of fresh) await ctx.db.insert("questProgress", { member, week, slot: slot.slot, quest: slot.quest, award, recipient, day, at });
  const before = questProgress(pooled, counted);
  const after = questProgress(pooled, [...counted, ...fresh]);
  if (after === pooled.progress.target && (await finishQuest(ctx, event.workspace, member, quest, slot, event.at))) {
    await notifyWeeklyQuestFinished(ctx, member, quest, pooled.goal, slot.reward.xp);
  }
  return after !== before;
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
  const { workspace } = await chatUserOf(ctx, member);
  const timeZone = await timeZoneOf(ctx, member);
  const { baseAllowance } = await settingsOf(ctx, workspace);
  const teammates = await teammatesOf(ctx, workspace, member);
  const lastThanked = await lastThankedBy(ctx, member, at);
  const left = (to: Recipient) => teammates.filter((teammate) => isRecipient(to, lastThanked.get(teammate) ?? null, at)).length;
  return {
    daysLeft: daysLeftInWeek(at, timeZone),
    kudosLeftToday: await allowanceLeft(ctx, member, allowanceDay(at, timeZone), baseAllowance),
    dailyAllowance: baseAllowance,
    peopleLeft: { anyone: left("anyone"), "someone-new": left("someone-new"), "someone-not-thanked-in-30-days": left("someone-not-thanked-in-30-days") },
  };
}

async function drawFor(ctx: MutationCtx, member: MemberId, at: number): Promise<"drawn" | "nothing to draw"> {
  const week = weekKeyOf(at, await timeZoneOf(ctx, member));
  if ((await drawOf(ctx, member, week)) !== null) return "nothing to draw";
  const slots = drawFrom(member, week, await drawFactsOf(ctx, member, at));
  if (slots.length === 0) return "nothing to draw";
  await ctx.db.insert("questDraws", { member, week, drawnAt: at, slots });
  return "drawn";
}

function drawFrom(member: MemberId, week: WeekKey, facts: DrawFacts): Slot[] {
  return rankedFeasible(member, week, facts)
    .slice(0, questsPerWeek)
    .map((feasible, slot) => slotOf(slot, feasible));
}

function rankedFeasible(member: MemberId, week: WeekKey, facts: DrawFacts): FeasibleQuest[] {
  const ranked = [...questPool.quests].sort((one, other) => rankOf(member, week, one) - rankOf(member, week, other));
  return ranked.flatMap((quest) => {
    const feasibleBecause = feasibility(quest, facts);
    return feasibleBecause === null ? [] : [{ quest, feasibleBecause }];
  });
}

function slotOf(slot: number, { quest: { quest, reward }, feasibleBecause }: FeasibleQuest): Slot {
  return { slot, quest, reward, catalogueVersion: questPool.version, feasibleBecause };
}

function rankOf(member: MemberId, week: WeekKey, { quest }: PoolQuest) {
  let hash = 0x811c9dc5;
  for (const character of `${member}:${week}:${quest}`) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

async function teammatesOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<MemberId[]> {
  const everyone = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .collect();
  return everyone.filter(({ _id, kind }) => kind === "member" && _id !== member).map(({ _id }) => _id);
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
