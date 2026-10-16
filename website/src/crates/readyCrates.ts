import { boughtCrateTargetOf, type BoughtCrateTarget } from "../../../convex/website/routes";
import { readyFeaturesOf, webPageOf } from "../features";
import type { QuestsShown } from "../questsRead";
import type { Screen } from "../route";
import type { FeatureCard, MemberProfile, Quest, QuestReward } from "../shell";

export type FeatureCrate = { kind: "feature"; card: FeatureCard; seen: string };

export type QuestCrate = { kind: "quest"; quest: Quest; reward: QuestReward; seen: string };

export type BoughtCrate = { kind: "bought"; crate: string; target: BoughtCrateTarget; seen: string };

export type ReadyCrate = FeatureCrate | QuestCrate | BoughtCrate;

export type CrateFacts = { crate: Quest | null; seen: string | null; reward: QuestReward };

export function featureCrateOf(card: FeatureCard): FeatureCrate {
  return { kind: "feature", card, seen: card.seen };
}

export function questCrateOf({ crate, seen, reward }: CrateFacts): QuestCrate | undefined {
  return crate === null || seen === null ? undefined : { kind: "quest", quest: crate, reward, seen };
}

export function boughtCrateOf(crate: string): BoughtCrate | undefined {
  const target = boughtCrateTargetOf(crate);
  return target === undefined ? undefined : { kind: "bought", crate, target, seen: crate };
}

export const boughtCrateLabel = "A crate you bought";

export function crateLabelOf(crate: ReadyCrate): string {
  if (crate.kind === "feature") return `Level ${crate.card.level} unlock`;
  return crate.kind === "quest" ? rewardLabelOf(crate) : boughtCrateLabel;
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
  if (crate.kind === "bought") return screen === "book";
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
