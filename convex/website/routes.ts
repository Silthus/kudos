import type { Infer } from "convex/values";
import type { Feature } from "../unlocks/feature";
import type { pageValidator } from "./link";

export type Page = Infer<typeof pageValidator>;

export const routeList: readonly string[] = ["/", "/leaderboard"];

const pathOf: Record<Page["page"], string> = {
  home: "/",
  leaderboard: "/leaderboard",
  quests: "/quests",
  skillTree: "/skills",
  book: "/book",
};

const featurePages: Partial<Record<Feature, Page>> = {
  quests: { page: "quests" },
  leaderboard: { page: "leaderboard", period: "week" },
  book: { page: "book" },
  skillTree: { page: "skillTree" },
};

export function routeOf(page: Page): string {
  if (!isListed(page)) return pathOf.home;
  const path = pathOf[page.page];
  return page.page === "leaderboard" && page.period !== "week" ? `${path}?period=${page.period}` : path;
}

export function listedPageOf(feature: Feature): Page | null {
  const page = featurePages[feature];
  return page !== undefined && isListed(page) ? page : null;
}

function isListed(page: Page) {
  return routeList.includes(pathOf[page.page]);
}
