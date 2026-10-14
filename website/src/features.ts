import type { ComponentType } from "react";
import { IconStar } from "@posthog/icons";
import type { Feature } from "../../convex/unlocks/feature";
import type { Screen } from "./route";
import type { MemberProfile } from "./shell";

export type WebPage = { screen: Screen; href: string; sentence: string; Icon: ComponentType<{ className?: string }> };

export type OpenWebPage = WebPage & { name: string };

const webPages: Partial<Record<Feature, WebPage>> = {
  leaderboard: { screen: "leaderboard", href: "/leaderboard", sentence: "See who's thanking colleagues this week.", Icon: IconStar },
};

export function webPageOf(feature: Feature): WebPage | undefined {
  return webPages[feature];
}

export function openWebPagesOf({ features, leaderboard }: Pick<MemberProfile, "features" | "leaderboard">): OpenWebPage[] {
  const open = features ?? (leaderboard === "open" ? [{ feature: "leaderboard" as const, name: "Leaderboard", state: "open" as const }] : []);
  return open.flatMap(({ feature, name, state }) => {
    const page = webPageOf(feature);
    return state === "open" && page !== undefined ? [{ ...page, name }] : [];
  });
}
