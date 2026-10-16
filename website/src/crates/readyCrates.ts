import { readyFeaturesOf, webPageOf } from "../features";
import type { QuestsShown } from "../questsRead";
import type { Screen } from "../route";
import type { FeatureCard, MemberProfile, Quest, QuestReward } from "../shell";

export type FeatureCrate = { kind: "feature"; card: FeatureCard; seen: string };

export type QuestCrate = { kind: "quest"; quest: Quest; reward: QuestReward; seen: string };

export type ReadyCrate = FeatureCrate | QuestCrate;

export type CrateFacts = { crate: Quest | null; seen: string | null; reward: QuestReward };

export function featureCrateOf(card: FeatureCard): FeatureCrate {
  return { kind: "feature", card, seen: card.seen };
}

export function questCrateOf({ crate, seen, reward }: CrateFacts): QuestCrate | undefined {
  return crate === null || seen === null ? undefined : { kind: "quest", quest: crate, reward, seen };
}

const rewardLabels: Record<Quest["kind"], string> = { journey: "Journey reward", weekly: "Quest reward", group: "Group quest reward" };

export function rewardLabelOf({ quest }: QuestCrate) {
  return rewardLabels[quest.kind];
}

export function readyCratesOf(member: MemberProfile, quests: QuestsShown | undefined): ReadyCrate[] {
  return [...readyFeaturesOf(member).map(featureCrateOf), ...questCratesOf(member, quests)];
}

export function isShownOn(crate: ReadyCrate, screen: Screen | undefined, quests: QuestsShown | undefined) {
  if (crate.kind === "feature") return screen === "home" || (screen !== undefined && screen === webPageOf(crate.card.feature)?.screen);
  if (crate.quest.kind !== "journey") return screen === "quests";
  return screen === "home" || (screen === "quests" && isTheBonus(crate, quests));
}

function isTheBonus({ seen }: QuestCrate, quests: QuestsShown | undefined) {
  return quests?.kind === "quests" && quests.bonus?.seen === seen;
}

function questCratesOf({ journey }: MemberProfile, quests: QuestsShown | undefined) {
  const weekly = quests?.kind === "quests" ? [...quests.slots, ...(quests.group === null ? [] : [quests.group]), ...quests.waiting] : [];
  return [...(journey ?? []), ...weekly].flatMap((facts) => questCrateOf(facts) ?? []);
}
