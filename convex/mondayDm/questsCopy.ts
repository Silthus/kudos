import { waitingHoggiesLineOf } from "../feedback/waitingHoggies";
import type { WaitingCount } from "../items/ledger";
import type { QuestsSection, SectionQuest } from "../quests/mondaySection";

export type ChecklistItem = { goal: string; mark: "done" | "next" | "open"; progress: string | null };

export type QuestsCopy = { heading: string; checklist: ChecklistItem[] };

const countWords = ["no", "one", "two", "three"];

const rewardOf: Record<QuestsSection["kind"], string> = {
  onboarding: "+50 XP and an unidentified Hoggie for your collection",
  drawn: "+20 XP and an unidentified Hoggie for your collection",
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
  return [`*Your onboarding journey* · ${section.done} of ${section.quests.length} done`, `${capitalized(countWordOf(left))} ${left === 1 ? "quest" : "quests"} left this week. ${eachPays(left, reward)}`];
}

function checklistOf(section: QuestsSection): ChecklistItem[] {
  const next = section.kind === "onboarding" ? section.quests.findIndex(({ finished }) => !finished) : -1;
  return section.quests.map((quest, index) => ({ goal: quest.goal, mark: quest.finished ? "done" : index === next ? "next" : "open", progress: progressOf(quest) }));
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
