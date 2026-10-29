import type { QueryCtx } from "../_generated/server";
import { websiteOrigin } from "../website/link";
import { listed, urlOf, type Page } from "../website/routes";
import { websiteAt, type VisitSource, type Website } from "../website/visitSource";
import { openTheWebsite } from "./naming";

export type DeepLink = { url: string; label: string };

type Destination = { page: Page; label: string };

const home: Page = { page: "home" };

export const deepLinks = {
  successReply: { page: home, label: "See your progress on the web" },
  welcome: { page: home, label: "See your progress" },
  levelReached: { page: home, label: "See your level on the web" },
  featuresShipped: { page: home, label: "See what's ready on the web" },
  journey: { page: home, label: "See your Journey on the web" },
  weeklyQuest: { page: { page: "quests" }, label: "See your quests on the web" },
  tiersEarned: { page: { page: "bookEarned" }, label: "See what you earned on the web" },
} satisfies Record<string, Destination>;

export function levelUpRevealOf(level: number): Destination {
  return { page: { page: "levelUp", level }, label: "Reveal your three new hoggies" };
}

export async function deepLinkOf(ctx: QueryCtx, workspace: string, destination: Destination, source: VisitSource): Promise<DeepLink | null> {
  return deepLinkFrom(websiteAt(await websiteOrigin(ctx, workspace), source), destination);
}

export function deepLinkFrom(website: Website | null, { page, label }: Destination): DeepLink | null {
  if (website === null) return null;
  return { url: urlOf(website.origin, page, website.source), label: listed(page) ? label : openTheWebsite };
}
