import type { MutationCtx } from "../_generated/server";
import { placeOf } from "../messageSettings/messageSettings";
import type { MemberId } from "../workspace/directory";
import { onTheMondayPath } from "./flag";
import { onboardingQuestsOf } from "./onboarding";
import { questOf, type PoolQuest } from "./pool";
import type { QuestProgress } from "./progress";
import { questStartOf } from "./start";
import { thisWeeksQuestsOf, type WeeklySlot } from "./weekly";

export type SectionQuest = { goal: string; finished: boolean; progress: QuestProgress | null };

export type QuestsSection = { kind: "onboarding"; done: number; quests: SectionQuest[] } | { kind: "drawn"; quests: SectionQuest[] };

const progressUnits: Record<PoolQuest["progress"]["counts"], QuestProgress["unit"]> = { recognitions: "kudos", people: "people", days: "days" };

export async function questsSectionFor(ctx: MutationCtx, member: MemberId, at: number): Promise<QuestsSection | null> {
  if (!(await mondayQuestsWantedBy(ctx, member))) return null;
  const onboarding = await onboardingQuestsOf(ctx, member, at);
  if (onboarding.some(({ finished }) => !finished)) {
    return { kind: "onboarding", done: onboarding.filter(({ finished }) => finished).length, quests: onboarding.map(({ goal, finished, progress }) => ({ goal, finished, progress })) };
  }
  const week = await thisWeeksQuestsOf(ctx, member, at);
  return week === null || week.slots.length === 0 ? null : { kind: "drawn", quests: week.slots.map(drawnQuestOf) };
}

async function mondayQuestsWantedBy(ctx: MutationCtx, member: MemberId) {
  return (await onTheMondayPath(ctx, member)) && (await questStartOf(ctx, member)) !== null && (await placeOf(ctx, member, "quests")) !== "none";
}

function drawnQuestOf({ quest, goal, progress, target, finishedAt }: WeeklySlot): SectionQuest {
  const counted = target > 1 ? { done: progress, of: target, unit: progressUnits[questOf(quest).progress.counts] } : null;
  return { goal: goal.replace(/\.$/, ""), finished: finishedAt !== null, progress: counted };
}
