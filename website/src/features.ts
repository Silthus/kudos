import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogWizard } from "@posthog/brand/hoggies";
import { IconBook, IconListTree, IconStar } from "@posthog/icons";
import type { Feature } from "../../convex/unlocks/feature";
import type { FeatureScreen, Screen } from "./route";
import type { MemberProfile } from "./shell";

export type Hoggie = ComponentType<{ size?: number; title?: string; className?: string }>;

export type About = { sentence: string; Hog: Hoggie };

export type WebPage = { screen: Screen; href: string; sentence: string; Icon: ComponentType<{ className?: string }> };

export type OpenWebPage = WebPage & { feature: Feature; name: string };

const about: Record<Feature, About> = {
  quests: { sentence: "Weekly quests of your own, and one your group takes on together.", Hog: HedgehogOrganized },
  leaderboard: { sentence: "See where you and your group stand.", Hog: HedgehogStar },
  book: { sentence: "Achievements you earn as you thank colleagues and they thank you.", Hog: HedgehogReading },
  skillTree: { sentence: "Perks you choose with skill points.", Hog: HedgehogWizard },
  coins: { sentence: "Coins you spend on hedgehogs and kudos emoji.", Hog: HedgehogMoney },
  hedgehogs: { sentence: "Hedgehogs to collect, and one to pick as your avatar.", Hog: HedgehogExplorer },
};

const webPages: Partial<Record<Feature, WebPage>> = {
  leaderboard: { screen: "leaderboard", href: "/leaderboard", sentence: "See who's thanking colleagues this week.", Icon: IconStar },
  book: { screen: "book", href: "/book", sentence: "See the tiers you've earned.", Icon: IconBook },
  skillTree: { screen: "skills", href: "/skills", sentence: "Spend skill points on perks you choose.", Icon: IconListTree },
};

export function aboutOf(feature: Feature): About {
  return about[feature];
}

export function webPageOf(feature: Feature): WebPage | undefined {
  return webPages[feature];
}

export function featureOn(screen: FeatureScreen): Feature {
  return (Object.keys(webPages) as Feature[]).find((feature) => webPages[feature]!.screen === screen)!;
}

export function openWebPagesOf({ features, leaderboard }: Pick<MemberProfile, "features" | "leaderboard">): OpenWebPage[] {
  const open = features ?? (leaderboard.kind === "open" ? [{ feature: "leaderboard" as const, name: "Leaderboard", state: "open" as const }] : []);
  return open.flatMap(({ feature, name, state }) => {
    const page = webPageOf(feature);
    return state === "open" && page !== undefined ? [{ ...page, feature, name }] : [];
  });
}

export function readyFeaturesOf({ features }: Pick<MemberProfile, "features">) {
  return (features ?? []).filter(({ state }) => state === "ready");
}
