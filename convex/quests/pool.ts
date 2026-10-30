import { v, type Infer } from "convex/values";
import { mondayCatalogueVersion } from "./mondayCatalogue";
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
  v.literal("kudos-once"),
  v.literal("kudos-two-days"),
  v.literal("three-in-a-day"),
);

export type QuestId = Infer<typeof questIdValidator>;

export type Recipient = "anyone" | "someone-new" | "someone-not-thanked-in-30-days";

export type PoolQuest = {
  quest: QuestId;
  kind: "breadth" | "thoughtfulness" | "participation";
  goal: string;
  progress: { counts: "recognitions" | "people" | "days" | "people-in-a-day"; target: number; given: { saysWhy: boolean; to: Recipient } };
  needs: ReadonlyArray<"groups" | "chime-ins" | "recent-joiners">;
  reward: Reward;
};

export type DrawFacts = { daysLeft: number; kudosLeftToday: number; dailyAllowance: number; peopleLeft: Record<Recipient, number> };

export const feasibleBecauseValidator = v.object({ peopleLeft: v.number(), recognitionsLeft: v.number(), daysLeft: v.optional(v.number()) });

export type FeasibleBecause = Infer<typeof feasibleBecauseValidator>;

type QuestPool = { version: string; quests: readonly PoolQuest[] };

const personalReward = { xp: 20, coins: 10, item: null };

export const mondayReward = { xp: 20, coins: 0, item: null };

const reachingOut = [
  thanking("someone-new", "Thank someone you haven't thanked before.", "someone-new", 1),
  thanking("two-new", "Thank 2 people you haven't thanked before.", "someone-new", 2),
  thanking("not-in-30-days", "Thank someone you haven't thanked in the last 30 days.", "someone-not-thanked-in-30-days", 1),
];

export const mondayQuestPool = {
  version: mondayCatalogueVersion,
  quests: [
    givingKudos("kudos-once", "Give a kudos to someone.", "recognitions", 1),
    givingKudos("kudos-two-days", "Thank someone on two different days.", "days", 2),
    givingKudos("three-in-a-day", "Thank 3 people in one day.", "people-in-a-day", 3),
    ...reachingOut,
  ].map((quest) => ({ ...quest, reward: mondayReward })),
} as const satisfies QuestPool;

export function withoutFullStop(goal: string): string {
  return goal.endsWith(".") ? goal.slice(0, -1) : goal;
}

export function questOf(quest: QuestId): PoolQuest {
  return mondayQuestPool.quests.find((entry) => entry.quest === quest)!;
}

export function feasibility({ progress }: PoolQuest, facts: DrawFacts): FeasibleBecause | null {
  const people = facts.peopleLeft[progress.given.to];
  const recognitionsLeft = Math.min(facts.kudosLeftToday, people) + Math.min(facts.dailyAllowance, people) * (facts.daysLeft - 1);
  if (people < (progress.counts === "recognitions" || progress.counts === "days" ? 1 : progress.target) || recognitionsLeft < progress.target) return null;
  if (progress.counts === "people-in-a-day") return aDayHolds(progress.target, people, facts) ? { peopleLeft: people, recognitionsLeft } : null;
  if (progress.counts !== "days") return { peopleLeft: people, recognitionsLeft };
  const daysLeft = facts.kudosLeftToday > 0 ? facts.daysLeft : facts.daysLeft - 1;
  return daysLeft < progress.target ? null : { peopleLeft: people, recognitionsLeft, daysLeft };
}

function aDayHolds(target: number, people: number, { dailyAllowance, kudosLeftToday, daysLeft }: DrawFacts): boolean {
  return dailyAllowance >= target && (Math.min(kudosLeftToday, people) >= target || daysLeft > 1);
}

function givingKudos(quest: QuestId, goal: string, counts: "recognitions" | "days" | "people-in-a-day", target: number): PoolQuest {
  return { quest, kind: "participation", goal, progress: { counts, target, given: { saysWhy: false, to: "anyone" } }, needs: [], reward: personalReward };
}

function thanking(quest: QuestId, goal: string, to: Exclude<Recipient, "anyone">, target: number): PoolQuest {
  return { quest, kind: "breadth", goal, progress: { counts: "people", target, given: { saysWhy: false, to } }, needs: [], reward: personalReward };
}
