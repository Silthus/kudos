import type { QueryCtx } from "../_generated/server";
import { websiteLink } from "../website/link";
import { listed, type Page } from "../website/routes";
import { openTheWebsite } from "./naming";

export type DeepLink = { url: string; label: string };

type Destination = { page: Page; label: string };

const home: Page = { page: "home" };

export const deepLinks = {
  successReply: { page: home, label: "See your progress on the web" },
  welcome: { page: home, label: openTheWebsite },
  levelReached: { page: home, label: "See your level on the web" },
  featuresShipped: { page: home, label: "See what's ready on the web" },
  journey: { page: home, label: "See your Journey on the web" },
  weeklyQuest: { page: { page: "quests" }, label: "See your quests on the web" },
} satisfies Record<string, Destination>;

export async function deepLinkOf(ctx: QueryCtx, workspace: string, { page, label }: Destination): Promise<DeepLink | null> {
  const url = await websiteLink(ctx, workspace, page);
  if (url === null) return null;
  return { url, label: listed(page) ? label : openTheWebsite };
}
