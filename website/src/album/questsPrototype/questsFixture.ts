// PROTOTYPE (Silthus/personal#172): throwaway fixture data for the website quests variants. Never merge.

export type QuestPhase = "onboarding" | "weekly";

export type PrototypeQuest = { id: string; goal: string; hint: string | null; have: number; need: number; unit: string; xp: number; hoggie: boolean };

export type QuestsShown = {
  phase: QuestPhase;
  onboarding: PrototypeQuest[];
  weekly: PrototypeQuest[];
  daysLeft: number;
  newQuestsOn: string;
};

const saysWhyHint = "It counts when your message has 5 or more words besides mentions and emoji.";

const onboarding: PrototypeQuest[] = [
  { id: "first-thanks", goal: "Thank someone and say why", hint: saysWhyHint, have: 1, need: 1, unit: "kudos", xp: 50, hoggie: true },
  { id: "someone-new", goal: "Thank someone you haven't thanked before", hint: null, have: 0, need: 1, unit: "person", xp: 50, hoggie: true },
  { id: "two-days", goal: "Say why on 2 different days", hint: saysWhyHint, have: 1, need: 2, unit: "days", xp: 50, hoggie: true },
];

const weekly: PrototypeQuest[] = [
  { id: "say-why-three-times", goal: "Thank someone and say why, 3 times", hint: saysWhyHint, have: 2, need: 3, unit: "kudos", xp: 20, hoggie: true },
  { id: "two-new", goal: "Thank 2 people you haven't thanked before", hint: null, have: 0, need: 2, unit: "people", xp: 20, hoggie: true },
  { id: "not-in-30-days", goal: "Thank someone you haven't thanked in 30 days", hint: null, have: 1, need: 1, unit: "person", xp: 20, hoggie: true },
];

export function questsShownIn(phase: QuestPhase): QuestsShown {
  return { phase, onboarding: phase === "onboarding" ? onboarding : onboarding.map((quest) => ({ ...quest, have: quest.need })), weekly, daysLeft: 3, newQuestsOn: "Monday" };
}

export function isDone({ have, need }: PrototypeQuest) {
  return have >= need;
}

export function doneCount(quests: PrototypeQuest[]) {
  return quests.filter(isDone).length;
}

export function questsInPlay({ phase, onboarding, weekly }: QuestsShown) {
  return phase === "onboarding" ? onboarding : weekly;
}
