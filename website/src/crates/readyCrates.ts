import { readyFeaturesOf, webPageOf } from "../features";
import type { QuestsShown } from "../questsRead";
import type { Screen } from "../route";
import type { FeatureCard, MemberProfile, Quest } from "../shell";

export type FeatureCrate = { kind: "feature"; card: FeatureCard; seen: string };

export type QuestCrate = { kind: "quest"; quest: Quest; xp: number; seen: string };

export type ReadyCrate = FeatureCrate | QuestCrate;

export type CrateFacts = { crate: Quest | null; seen: string | null; reward: { xp: number } };

export function featureCrateOf(card: FeatureCard): FeatureCrate {
  return { kind: "feature", card, seen: card.seen };
}

export function questCrateOf({ crate, seen, reward }: CrateFacts): QuestCrate | undefined {
  return crate === null || seen === null ? undefined : { kind: "quest", quest: crate, xp: reward.xp, seen };
}

export function rewardLabelOf({ quest }: QuestCrate) {
  return quest.kind === "journey" ? "Journey reward" : "Quest reward";
}

export function readyCratesOf(member: MemberProfile, quests: QuestsShown | undefined): ReadyCrate[] {
  return [...readyFeaturesOf(member).map(featureCrateOf), ...questCratesOf(member, quests)];
}

export function isShownOn(crate: ReadyCrate, screen: Screen | undefined) {
  if (crate.kind === "feature") return screen === "home" || (screen !== undefined && screen === webPageOf(crate.card.feature)?.screen);
  return screen === (crate.quest.kind === "journey" ? "home" : "quests");
}

function questCratesOf({ journey }: MemberProfile, quests: QuestsShown | undefined) {
  const weekly = quests?.kind === "quests" ? [...quests.slots, ...quests.waiting] : [];
  return [...(journey ?? []), ...weekly].flatMap((facts) => questCrateOf(facts) ?? []);
}
