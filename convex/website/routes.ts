import type { Infer } from "convex/values";
import type { Quest } from "../quests/step";
import type { Feature } from "../unlocks/feature";
import type { pageValidator } from "./link";

export type Page = Infer<typeof pageValidator>;

export const routeList: readonly string[] = ["/", "/leaderboard", "/quests", "/skills", "/book"];

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

export function listed(page: Page): boolean {
  return routeList.includes(pathOf[page.page]);
}

export function routeOf(page: Page): string {
  if (!listed(page)) return pathOf.home;
  const path = pathOf[page.page];
  return page.page === "leaderboard" && page.period !== "week" ? `${path}?period=${page.period}` : path;
}

export function listedPageOf(feature: Feature): Page | null {
  const page = featurePages[feature];
  return page !== undefined && listed(page) ? page : null;
}

export function readyCratePageOf(feature: Feature): Page {
  return listedPageOf(feature) ?? { page: "home" };
}

export function questCratePageOf(quest: Quest): Page {
  return quest.kind === "journey" ? { page: "home" } : { page: "quests" };
}

export function urlOf(origin: string, page: Page) {
  return `${origin}${routeOf(page)}`;
}
