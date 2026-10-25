// PROTOTYPE (Silthus/personal#172): throwaway fixture data for the website quests prototype, round 2. Never merge.

export type QuestPhase = "onboarding" | "weekly";

export type StartedMode = "merge" | "replace" | "coexist";

export type JourneyStep = { id: string; goal: string; hint: string | null; have: number; need: number; unit: string; reward: { xp: number } | null; afterward: string | null };

export type QuestsShown = { phase: QuestPhase; journey: JourneyStep[]; weekly: JourneyStep[]; daysLeft: number };

const saysWhyHint = "Five words or more besides the mention and the emoji, and it counts.";

const hug: JourneyStep = { id: "hug", goal: "Give your first hug", hint: null, have: 1, need: 1, unit: "hug", reward: null, afterward: null };

const firstThanks: JourneyStep = { id: "first-thanks", goal: "Thank someone and say why", hint: saysWhyHint, have: 1, need: 1, unit: "kudos", reward: { xp: 50 }, afterward: null };

const turnIt: JourneyStep = { id: "turn", goal: "Turn the hoggie it left on your board", hint: null, have: 0, need: 1, unit: "hoggie", reward: null, afterward: null };

const someoneNew: JourneyStep = { id: "someone-new", goal: "Thank someone you haven't thanked before", hint: "Someone from another team counts, and so does a new joiner.", have: 0, need: 1, unit: "person", reward: { xp: 50 }, afterward: null };

const twoDays: JourneyStep = { id: "two-days", goal: "Say why on 2 different days", hint: saysWhyHint, have: 1, need: 2, unit: "days", reward: { xp: 50 }, afterward: null };

const weekly: JourneyStep[] = [
  { id: "say-why-three-times", goal: "Thank someone and say why, 3 times", hint: saysWhyHint, have: 2, need: 3, unit: "kudos", reward: { xp: 20 }, afterward: null },
  { id: "two-new", goal: "Thank 2 people you haven't thanked before", hint: null, have: 0, need: 2, unit: "people", reward: { xp: 20 }, afterward: null },
  { id: "not-in-30-days", goal: "Thank someone you haven't thanked in 30 days", hint: null, have: 1, need: 1, unit: "person", reward: { xp: 20 }, afterward: "Turn it on your board" },
];

function journeyIn(mode: StartedMode): JourneyStep[] {
  if (mode === "merge") return [hug, firstThanks, turnIt, someoneNew, twoDays];
  return [{ ...firstThanks, afterward: mode === "replace" ? "Turn it on your board" : null }, someoneNew, twoDays];
}

export function questsShownIn(phase: QuestPhase, mode: StartedMode): QuestsShown {
  return { phase, journey: journeyIn(mode), weekly, daysLeft: 3 };
}

export function isDone({ have, need }: JourneyStep) {
  return have >= need;
}

export function doneCount(steps: JourneyStep[]) {
  return steps.filter(isDone).length;
}

export function stepsInPlay({ phase, journey, weekly }: QuestsShown) {
  return phase === "onboarding" ? journey : weekly;
}
