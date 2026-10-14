import type { QueryCtx } from "../_generated/server";
import { websiteOrigin } from "../website/link";
import { listed, urlOf, type Page } from "../website/routes";
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
} satisfies Record<string, Destination>;

export async function deepLinkOf(ctx: QueryCtx, workspace: string, destination: Destination): Promise<DeepLink | null> {
  return deepLinkFrom(await websiteOrigin(ctx, workspace), destination);
}

export function deepLinkFrom(website: string | null, { page, label }: Destination): DeepLink | null {
  if (website === null) return null;
  return { url: urlOf(website, page), label: listed(page) ? label : openTheWebsite };
}
