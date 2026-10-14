import type { JourneyStep } from "./step";

export type JourneyStepCopy = { goal: string; hint: string | null };

const journeyCopy: Record<JourneyStep, JourneyStepCopy> = {
  "first-thanks": { goal: "Give a kudos that says why.", hint: "It counts when your message has 5 or more words besides mentions and emoji." },
  "first-quest": { goal: "Finish a weekly quest.", hint: null },
  "someone-new": { goal: "Thank someone you haven't thanked before.", hint: null },
  "two-days": { goal: "Give kudos that say why on 2 different days.", hint: "It counts when your message has 5 or more words besides mentions and emoji." },
};

export function journeyCopyOf(step: JourneyStep): JourneyStepCopy {
  return journeyCopy[step];
}

export function journeyGoalOf(step: JourneyStep): string {
  return journeyCopy[step].goal;
}
