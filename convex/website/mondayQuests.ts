import type { QueryCtx } from "../_generated/server";
import { givenBetween } from "../engine/awards";
import { hasHuggedBefore } from "../hugs/records";
import { earnedItemOf, newestTurnOf } from "../items/ledger";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf } from "../progression/rewards";
import { rewardKeyOf } from "../quests/crates";
import { questItemKeyOf } from "../quests/finish";
import { saysWhyCounts } from "../quests/journeyCopy";
import { nextOnboardingQuestOf, onboardingFinishedBy, onboardingGoalOf, onboardingReward, type OnboardingStep } from "../quests/onboarding";
import type { QuestId } from "../quests/pool";
import { questStartOf } from "../quests/start";
import type { Quest } from "../quests/step";
import { daysLeftInWeek } from "../quests/week";
import { drawnWeekOf, isMondayDraw, type DrawnWeek } from "../quests/weekly";
import type { MemberId } from "../workspace/directory";
import { followTheClock } from "./clock";
import type { VerifiedMember } from "./memberQuery";

export type QuestItemState = "waiting" | "turned" | null;

export type QuestProgress = { done: number; target: number };

export type GettingStartedStepId = "hug" | OnboardingStep | "turn";

export type GettingStartedStep = { step: GettingStartedStepId; goal: string; hint: string | null; progress: QuestProgress; done: boolean; reward: { xp: number } | null; item: QuestItemState };

export type DrawnQuest = { quest: QuestId; goal: string; progress: QuestProgress; done: boolean; reward: { xp: number }; item: QuestItemState };

export type MondayQuestList = { kind: "journey"; steps: GettingStartedStep[] } | { kind: "drawn"; quests: DrawnQuest[] };

export type MondayQuests = { kind: "monday"; firstName: string | null; next: OnboardingStep | null; daysLeft: number; quests: MondayQuestList };

const daysSayingWhyForTwoDays = 2;

const once: QuestProgress = { done: 0, target: 1 };

const guidance: Record<"hug" | "turn", { goal: string; hint: string | null }> = {
  hug: { goal: "Give your first hug", hint: "React with your kudos emoji on any message in Slack." },
  turn: { goal: "Identify the hoggie it left on your board", hint: null },
};

const questHints: Record<OnboardingStep, string> = {
  "first-thanks": saysWhyCounts,
  "someone-new": "Someone from another team counts, and so does a new joiner.",
  "two-days": saysWhyCounts,
};

export async function mondayQuestsOf(ctx: QueryCtx, me: VerifiedMember): Promise<MondayQuests> {
  await followTheClock(ctx);
  const at = Date.now();
  const timeZone = (await ctx.db.get(me.member))?.timeZone;
  return {
    kind: "monday",
    firstName: firstNameOf(me),
    next: await nextOnboardingQuestOf(ctx, me.member),
    daysLeft: daysLeftInWeek(at, timeZone),
    quests: await questListOf(ctx, me.member, at),
  };
}

async function questListOf(ctx: QueryCtx, member: MemberId, at: number): Promise<MondayQuestList> {
  const week = (await onboardingFinishedBy(ctx, member)) ? await drawnWeekOf(ctx, member, at) : null;
  if (week === null || !isMondayDraw(week)) return { kind: "journey", steps: await gettingStartedOf(ctx, member, at) };
  return { kind: "drawn", quests: await Promise.all(week.slots.map((slot) => drawnQuestOf(ctx, member, slot))) };
}

async function gettingStartedOf(ctx: QueryCtx, member: MemberId, at: number): Promise<GettingStartedStep[]> {
  return [
    guidanceStep("hug", await hasHuggedBefore(ctx, member)),
    await questStepOf(ctx, member, "first-thanks", once),
    guidanceStep("turn", (await newestTurnOf(ctx, member)) !== null),
    await questStepOf(ctx, member, "someone-new", once),
    await questStepOf(ctx, member, "two-days", { done: await daysSayingWhySinceTheStart(ctx, member, at), target: daysSayingWhyForTwoDays }),
  ];
}

function guidanceStep(step: "hug" | "turn", done: boolean): GettingStartedStep {
  return { step, ...guidance[step], progress: { done: done ? 1 : 0, target: 1 }, done, reward: null, item: null };
}

async function questStepOf(ctx: QueryCtx, member: MemberId, step: OnboardingStep, unfinished: QuestProgress): Promise<GettingStartedStep> {
  const quest: Quest = { kind: "journey", step };
  const finish = await rewardOf(ctx, member, rewardKeyOf(quest));
  const done = finish !== null;
  return {
    step,
    goal: onboardingGoalOf(step),
    hint: questHints[step],
    progress: done ? { done: unfinished.target, target: unfinished.target } : unfinished,
    done,
    reward: { xp: finish?.xp ?? onboardingReward.xp },
    item: done ? await itemStateOf(ctx, member, quest) : null,
  };
}

async function drawnQuestOf(ctx: QueryCtx, member: MemberId, { quest, goal, progress, target, finishedAt, reward, crate }: DrawnWeek["slots"][number]): Promise<DrawnQuest> {
  const done = finishedAt !== null;
  return { quest, goal: goal.replace(/\.$/, ""), progress: { done: progress, target }, done, reward: { xp: reward.xp }, item: done ? await itemStateOf(ctx, member, crate) : null };
}

async function itemStateOf(ctx: QueryCtx, member: MemberId, quest: Quest): Promise<QuestItemState> {
  const item = await earnedItemOf(ctx, member, "hoggie", questItemKeyOf(rewardKeyOf(quest)));
  if (item === null) return null;
  return item.turnedAt === undefined ? "waiting" : "turned";
}

async function daysSayingWhySinceTheStart(ctx: QueryCtx, member: MemberId, at: number): Promise<number> {
  const start = await questStartOf(ctx, member);
  if (start === null) return 0;
  const sayingWhy = (await givenBetween(ctx, member, start, at)).filter(({ annotations }) => gateDecisionOf(annotations)?.thoughtful === true);
  return Math.min(daysSayingWhyForTwoDays, new Set(sayingWhy.map(({ day }) => day)).size);
}

function firstNameOf({ givenName, name }: VerifiedMember): string | null {
  return givenName ?? name?.split(/\s+/)[0] ?? null;
}
