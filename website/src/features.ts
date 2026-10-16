import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogWizard, type Hoggie } from "./hoggies";
import { IconBook, IconListTree, IconStar, IconTarget } from "@posthog/icons";
import { perkOf } from "../../convex/progression/tree";
import type { Screen } from "./route";
import type { Feature, MemberProfile } from "./shell";

export type WebPage = { screen: Screen; href: string; sentence: string; Icon: ComponentType<{ className?: string }> };

const plainNames: Record<Feature, string> = {
  quests: "Quests",
  leaderboard: "Leaderboard",
  book: "Book",
  skillTree: "Skill tree",
  coins: "Coins",
  hedgehogs: "Hedgehogs",
};

export function plainNameOf(feature: Feature): string {
  return plainNames[feature];
}

type GrammaticalNumber = "singular" | "plural";

const grammaticalNumbers: Record<Feature, GrammaticalNumber> = {
  quests: "plural",
  leaderboard: "singular",
  book: "singular",
  skillTree: "singular",
  coins: "plural",
  hedgehogs: "plural",
};

export function isOrAre(feature: Feature): "is" | "are" {
  return grammaticalNumbers[feature] === "plural" ? "are" : "is";
}

export function itOrThem(feature: Feature): "it" | "them" {
  return grammaticalNumbers[feature] === "plural" ? "them" : "it";
}

const hogs: Record<Feature, Hoggie> = {
  quests: HedgehogOrganized,
  leaderboard: HedgehogStar,
  book: HedgehogReading,
  skillTree: HedgehogWizard,
  coins: HedgehogMoney,
  hedgehogs: HedgehogExplorer,
};

const sentences: Record<Feature, string> = {
  quests: "Weekly quests of your own.",
  leaderboard: "See where you stand.",
  book: "Achievements you earn as you thank colleagues and they thank you.",
  skillTree: "Perks you choose with skill points.",
  coins: "Coins you spend on hedgehogs and kudos emoji.",
  hedgehogs: "Hedgehogs to collect, and one to pick as your avatar.",
};

const sentencesNamingGroups: Partial<Record<Feature, string>> = {
  leaderboard: "See where you and your group stand.",
};

const webPages = {
  leaderboard: { screen: "leaderboard", href: "/leaderboard", sentence: "See who's thanking colleagues this week.", Icon: IconStar },
  quests: { screen: "quests", href: "/quests", sentence: "Your quests this week.", Icon: IconTarget },
  book: { screen: "book", href: "/book", sentence: "See the tiers you've earned.", Icon: IconBook },
  skillTree: { screen: "skills", href: "/skills", sentence: "Spend skill points on perks you choose.", Icon: IconListTree },
} satisfies Partial<Record<Feature, WebPage>>;

export type PagedFeature = keyof typeof webPages;

const spark = perkOf("spark");

const waits: Record<PagedFeature, string[]> = {
  quests: ["Three quests of your own each week, new every Monday", "Swap one of them once a week", "XP for each quest you finish"],
  leaderboard: ["Who's thanking colleagues most this week, this month and of all time", "Only kudos given count, never kudos received"],
  book: ["Achievements for the thanks you give and the thanks you get", "Bronze, silver, gold and diamond tiers on every ladder"],
  skillTree: ["Your first skill point to spend, and one more each level", `${spark.name}: ${spark.copy}`],
};

export function waitsOf(feature: Feature): string[] {
  return hasWebPage(feature) ? waits[feature] : [];
}

export function hogOf(feature: Feature): Hoggie {
  return hogs[feature];
}

export function sentenceOf(feature: Feature, { groups }: Pick<MemberProfile, "groups">): string {
  return (groups ? sentencesNamingGroups[feature] : undefined) ?? sentences[feature];
}

export function webPageOf(feature: Feature): WebPage | undefined {
  return hasWebPage(feature) ? webPages[feature] : undefined;
}

export function openWebPageOf({ features }: Pick<MemberProfile, "features">, feature: Feature): WebPage | undefined {
  const open = (features ?? []).some((card) => card.feature === feature && card.state === "open");
  return open ? webPageOf(feature) : undefined;
}

export function pageOf(feature: PagedFeature): WebPage {
  return webPages[feature];
}

function hasWebPage(feature: Feature): feature is PagedFeature {
  return feature in webPages;
}

export function readyFeaturesOf({ features }: Pick<MemberProfile, "features">) {
  return (features ?? []).filter(({ state }) => state === "ready");
}
