import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogWizard } from "@posthog/brand/hoggies";
import { IconStar } from "@posthog/icons";
import type { Screen } from "./route";
import type { Feature, MemberProfile } from "./shell";

export type Hoggie = ComponentType<{ size?: number; title?: string; className?: string }>;

export type About = { sentence: string; Hog: Hoggie };

export type WebPage = { screen: Screen; href: string; sentence: string; Icon: ComponentType<{ className?: string }> };

export type OpenWebPage = WebPage & { feature: Feature; name: string };

const plainNames: Record<Feature, string> = {
  quests: "Quests",
  leaderboard: "Leaderboard",
  book: "Sticker book and achievements",
  skillTree: "Skill tree",
  coins: "Coins",
  hedgehogs: "Hedgehogs",
};

export const plainFeatures = Object.entries(plainNames).map(([feature, name]) => ({ feature: feature as Feature, name }));

const about: Record<Feature, About> = {
  quests: { sentence: "Weekly quests of your own, and one your group takes on together.", Hog: HedgehogOrganized },
  leaderboard: { sentence: "See where you and your group stand.", Hog: HedgehogStar },
  book: { sentence: "Stickers from colleagues you thanked or who thanked you, and the achievements you collect.", Hog: HedgehogReading },
  skillTree: { sentence: "Perks you choose with skill points.", Hog: HedgehogWizard },
  coins: { sentence: "Coins you spend on hedgehogs and kudos emoji.", Hog: HedgehogMoney },
  hedgehogs: { sentence: "Hedgehogs to collect, and one to pick as your avatar.", Hog: HedgehogExplorer },
};

const webPages: Partial<Record<Feature, WebPage>> = {
  leaderboard: { screen: "leaderboard", href: "/leaderboard", sentence: "See who's thanking colleagues this week.", Icon: IconStar },
};

export function aboutOf(feature: Feature): About {
  return about[feature];
}

export function webPageOf(feature: Feature): WebPage | undefined {
  return webPages[feature];
}

export function openWebPagesOf({ features, leaderboard }: Pick<MemberProfile, "features" | "leaderboard">): OpenWebPage[] {
  const open = features ?? (leaderboard.kind === "open" ? [{ feature: "leaderboard" as const, name: plainNames.leaderboard, state: "open" as const }] : []);
  return open.flatMap(({ feature, name, state }) => {
    const page = webPageOf(feature);
    return state === "open" && page !== undefined ? [{ ...page, feature, name }] : [];
  });
}

export function readyFeaturesOf({ features }: Pick<MemberProfile, "features">) {
  return (features ?? []).filter(({ state }) => state === "ready");
}
