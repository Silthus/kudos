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
import { feasibility, feasibleBecauseValidator, questIdValidator, questOf, questPool, type DrawFacts, type PoolQuest, type Recipient } from "./pool";
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

type Slot = Infer<typeof slotValidator>;

type Draw = Infer<typeof questDrawValidator>;

export type WeeklySlot = Slot & { goal: string; progress: number; target: number; finishedAt: number | null; openedAt: number | null };

export type WeeklyQuests = { week: WeekKey; drawnAt: number; slots: WeeklySlot[] };

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
    if (draw === null || event.at < draw.drawnAt) return;
    const open = await unfinishedSlotsOf(ctx, draw);
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
  const slots: WeeklySlot[] = [];
  for (const slot of draw.slots) slots.push(await weeklySlotOf(ctx, draw, slot));
  return { week, drawnAt, slots };
}

async function weeklySlotOf(ctx: QueryCtx, { member, week }: Draw, slot: Slot): Promise<WeeklySlot> {
  const pooled = questOf(slot.quest);
  const key = rewardKeyOf(weeklyQuest(week, slot));
  const finish = await rewardOf(ctx, member, key);
  const opening = await crateOpeningOf(ctx, member, key);
  const progress = questProgress(pooled, await countedFor(ctx, member, week, slot));
  return { ...slot, goal: pooled.goal, progress, target: pooled.progress.target, finishedAt: finish?.at ?? null, openedAt: opening?.at ?? null };
}

async function unfinishedSlotsOf(ctx: QueryCtx, { member, week, slots }: Draw): Promise<Slot[]> {
  const open: Slot[] = [];
  for (const slot of slots) if ((await rewardOf(ctx, member, rewardKeyOf(weeklyQuest(week, slot)))) === null) open.push(slot);
  return open;
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
  const shuffled = [...questPool.quests].sort((one, other) => rankOf(member, week, one) - rankOf(member, week, other));
  const feasible = shuffled.flatMap((quest) => {
    const feasibleBecause = feasibility(quest, facts);
    return feasibleBecause === null ? [] : [{ quest, feasibleBecause }];
  });
  return feasible.slice(0, questsPerWeek).map(({ quest: { quest, reward }, feasibleBecause }, slot) => ({
    slot,
    quest,
    reward,
    catalogueVersion: questPool.version,
    feasibleBecause,
  }));
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
