import { v, type Infer } from "convex/values";
import type { attributedAwardValidator } from "../groups/attributedAward";
import type { GroupId } from "../groups/groups";
import type { Reward } from "./journey";
import { drawRank } from "./rank";

export const groupQuestIdValidator = v.union(v.literal("together-say-why"), v.literal("together-reach-out"));

export type GroupQuestId = Infer<typeof groupQuestIdValidator>;

export const groupFeasibleBecauseValidator = v.object({ participants: v.number(), membersOutside: v.number() });

export type GroupFeasibleBecause = Infer<typeof groupFeasibleBecauseValidator>;

type AttributedAward = Infer<typeof attributedAwardValidator>;

type GroupPoolQuest = { quest: GroupQuestId; goal: (group: string) => string; feasible: (facts: GroupFeasibleBecause) => boolean; does: (award: AttributedAward, group: GroupId) => boolean };

export const groupQuestPool = {
  version: "1",
  reward: { xp: 0, coins: 15, item: null },
  quests: [
    { quest: "together-say-why", goal: () => "Thank someone and say why.", feasible: () => true, does: ({ saysWhy }) => saysWhy },
    {
      quest: "together-reach-out",
      goal: (group) => `Thank someone outside ${group}.`,
      feasible: ({ membersOutside }) => membersOutside > 0,
      does: ({ recipientGroup }, group) => recipientGroup !== group,
    },
  ],
} as const satisfies { version: string; reward: Reward; quests: readonly GroupPoolQuest[] };

export function groupGoalOf(quest: GroupQuestId, group: string): string {
  return poolQuestOf(quest).goal(group);
}

export function doesGroupQuestAction(quest: GroupQuestId, group: GroupId, awards: AttributedAward[]): boolean {
  return awards.some((award) => poolQuestOf(quest).does(award, group));
}

function poolQuestOf(quest: GroupQuestId): GroupPoolQuest {
  return groupQuestPool.quests.find((entry) => entry.quest === quest)!;
}

export function groupTargetOf(participants: number): number {
  return Math.min(3, participants - 1);
}

export function drawGroupQuest(group: string, week: string, facts: GroupFeasibleBecause): GroupQuestId {
  const feasible = groupQuestPool.quests.filter((entry) => entry.feasible(facts));
  const rankOf = ({ quest }: GroupPoolQuest) => drawRank(`${group}:${week}:${quest}`);
  return feasible.toSorted((one, other) => rankOf(one) - rankOf(other))[0]!.quest;
}
