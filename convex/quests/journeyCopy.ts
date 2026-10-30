import type { JourneyStep } from "./step";

const journeyGoals: Record<JourneyStep, string> = {
  "first-thanks": "Give a kudos that says why.",
  "first-quest": "Finish a weekly quest.",
  "someone-new": "Thank someone you haven't thanked before.",
  "two-days": "Give kudos that say why on 2 different days.",
  "your-emoji": "Give a kudos that says why with one of your kudos emoji.",
};

export function journeyGoalOf(step: JourneyStep): string {
  return journeyGoals[step];
}
