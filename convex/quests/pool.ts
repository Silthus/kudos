import { v, type Infer } from "convex/values";
import type { Reward } from "./journey";

export const questIdValidator = v.union(
  v.literal("say-why"),
  v.literal("say-why-twice"),
  v.literal("say-why-three-times"),
  v.literal("say-why-two-days"),
  v.literal("say-why-three-days"),
  v.literal("someone-new"),
  v.literal("two-new"),
  v.literal("not-in-30-days"),
);

export type QuestId = Infer<typeof questIdValidator>;

export type Recipient = "anyone" | "someone-new" | "someone-not-thanked-in-30-days";

export type Quest = {
  quest: QuestId;
  kind: "breadth" | "thoughtfulness" | "participation";
  goal: string;
  progress: { counts: "recognitions" | "people" | "days"; target: number; given: { saysWhy: boolean; to: Recipient } };
  needs: ReadonlyArray<"groups" | "chime-ins" | "recent-joiners">;
  reward: Reward;
};

export type DrawFacts = { daysLeft: number; kudosLeftToday: number; dailyAllowance: number; peopleLeft: Record<Recipient, number> };

export const feasibleBecauseValidator = v.object({ peopleLeft: v.number(), recognitionsLeft: v.number(), daysLeft: v.optional(v.number()) });

export type FeasibleBecause = Infer<typeof feasibleBecauseValidator>;

const personalReward = { xp: 20, coins: 0, item: null };

export const questPool = {
  version: "1",
  quests: [
    sayingWhy("say-why", "Thank someone and say why.", "recognitions", 1),
    sayingWhy("say-why-twice", "Thank someone and say why, 2 times.", "recognitions", 2),
    sayingWhy("say-why-three-times", "Thank someone and say why, 3 times.", "recognitions", 3),
    sayingWhy("say-why-two-days", "Thank someone and say why on 2 different days.", "days", 2),
    sayingWhy("say-why-three-days", "Thank someone and say why on 3 different days.", "days", 3),
    thanking("someone-new", "Thank someone you haven't thanked before.", "someone-new", 1),
    thanking("two-new", "Thank 2 people you haven't thanked before.", "someone-new", 2),
    thanking("not-in-30-days", "Thank someone you haven't thanked in the last 30 days.", "someone-not-thanked-in-30-days", 1),
  ],
} as const satisfies { version: string; quests: readonly Quest[] };

export function questOf(quest: QuestId): Quest {
  return questPool.quests.find((entry) => entry.quest === quest)!;
}

export function feasibility({ progress }: Quest, facts: DrawFacts): FeasibleBecause | null {
  const people = facts.peopleLeft[progress.given.to];
  const recognitionsLeft = facts.kudosLeftToday + facts.dailyAllowance * (facts.daysLeft - 1);
  if (people < (progress.counts === "people" ? progress.target : 1) || recognitionsLeft < progress.target) return null;
  if (progress.counts !== "days") return { peopleLeft: people, recognitionsLeft };
  const daysLeft = facts.kudosLeftToday > 0 ? facts.daysLeft : facts.daysLeft - 1;
  return daysLeft < progress.target ? null : { peopleLeft: people, recognitionsLeft, daysLeft };
}

function sayingWhy(quest: QuestId, goal: string, counts: "recognitions" | "days", target: number): Quest {
  return { quest, kind: "thoughtfulness", goal, progress: { counts, target, given: { saysWhy: true, to: "anyone" } }, needs: [], reward: personalReward };
}

function thanking(quest: QuestId, goal: string, to: Exclude<Recipient, "anyone">, target: number): Quest {
  return { quest, kind: "breadth", goal, progress: { counts: "people", target, given: { saysWhy: false, to } }, needs: [], reward: personalReward };
}
