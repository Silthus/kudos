import { hoggieRewardOf, waitingHoggiesLineOf } from "../feedback/waitingHoggies";
import type { WaitingCount } from "../album/items/ledger";
import type { QuestsSection, SectionQuest } from "../quests/mondaySection";
import { onboardingReward } from "../quests/onboarding";
import { mondayReward } from "../quests/pool";

export type ChecklistItem = { goal: string; mark: "done" | "next" | "open"; progress: string | null };

export type QuestsCopy = { heading: string; checklist: ChecklistItem[] };

const countWords = ["no", "one", "two", "three"];

const rewardOf: Record<QuestsSection["kind"], string> = {
  onboarding: hoggieRewardOf(onboardingReward.xp),
  drawn: hoggieRewardOf(mondayReward.xp),
};

export function questsCopyOf(section: QuestsSection, waiting: WaitingCount): QuestsCopy {
  const waitingLine = waitingHoggiesLineOf(waiting);
  const heading = [...headingLinesOf(section), ...(waitingLine === null ? [] : ["", waitingLine])].join("\n");
  return { heading, checklist: checklistOf(section) };
}

function headingLinesOf(section: QuestsSection): string[] {
  const reward = rewardOf[section.kind];
  if (section.kind === "drawn") {
    const count = section.quests.length;
    return [`Happy Monday :sun_with_face: Here ${count === 1 ? "is one quest" : `are ${countWordOf(count)} quests`} for your week. ${eachPays(count, reward)}`];
  }
  const left = section.quests.length - section.done;
  return [onboardingHeadingOf(section.done, section.quests.length), `${capitalized(countWordOf(left))} ${left === 1 ? "quest" : "quests"} left. ${eachPays(left, reward)}`];
}

export function onboardingHeadingOf(done: number, of: number): string {
  return `*Your onboarding journey* · ${done} of ${of} done`;
}

export function onboardingChecklistOf(quests: SectionQuest[]): ChecklistItem[] {
  const next = quests.findIndex(({ finished }) => !finished);
  return quests.map((quest, index) => checklistItemOf(quest, index === next));
}

function checklistOf(section: QuestsSection): ChecklistItem[] {
  return section.kind === "onboarding" ? onboardingChecklistOf(section.quests) : section.quests.map((quest) => checklistItemOf(quest, false));
}

function checklistItemOf(quest: SectionQuest, isNext: boolean): ChecklistItem {
  return { goal: quest.goal, mark: quest.finished ? "done" : isNext ? "next" : "open", progress: progressOf(quest) };
}

function progressOf({ finished, progress }: SectionQuest): string | null {
  return finished || progress === null ? null : `${progress.done} of ${progress.of} ${progress.unit}`;
}

function eachPays(count: number, reward: string) {
  return `${count === 1 ? "It pays" : "Each one pays"} ${reward}.`;
}

function countWordOf(count: number) {
  return countWords[count] ?? String(count);
}

function capitalized(word: string) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}
