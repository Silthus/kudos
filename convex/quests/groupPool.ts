import { v, type Infer } from "convex/values";
import type { Reward } from "./journey";
import { drawRank } from "./rank";

export const groupQuestIdValidator = v.union(v.literal("together-say-why"), v.literal("together-reach-out"));

export type GroupQuestId = Infer<typeof groupQuestIdValidator>;

export const groupFeasibleBecauseValidator = v.object({ participants: v.number(), membersOutside: v.number() });

export type GroupFeasibleBecause = Infer<typeof groupFeasibleBecauseValidator>;

type GroupPoolQuest = { quest: GroupQuestId; goal: (group: string) => string; feasible: (facts: GroupFeasibleBecause) => boolean };

export const groupQuestPool = {
  version: "1",
  reward: { xp: 0, coins: 15, item: null },
  quests: [
    { quest: "together-say-why", goal: () => "Thank someone and say why.", feasible: () => true },
    { quest: "together-reach-out", goal: (group) => `Thank someone outside ${group}.`, feasible: ({ membersOutside }) => membersOutside > 0 },
  ],
} as const satisfies { version: string; reward: Reward; quests: readonly GroupPoolQuest[] };

export function groupGoalOf(quest: GroupQuestId, group: string): string {
  return groupQuestPool.quests.find((entry) => entry.quest === quest)!.goal(group);
}

export function groupTargetOf(participants: number): number {
  return Math.min(3, participants - 1);
}

export function drawGroupQuest(group: string, week: string, facts: GroupFeasibleBecause): GroupQuestId {
  const feasible = groupQuestPool.quests.filter((entry) => entry.feasible(facts));
  const rankOf = ({ quest }: GroupPoolQuest) => drawRank(`${group}:${week}:${quest}`);
  return feasible.toSorted((one, other) => rankOf(one) - rankOf(other))[0]!.quest;
}
