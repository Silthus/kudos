import type { Infer } from "convex/values";
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

export function listed(page: Page): boolean {
  return routeList.includes(pathOf[page.page]);
}

export function routeOf(page: Page): string {
  if (!listed(page)) return pathOf.home;
  const path = pathOf[page.page];
  return page.page === "leaderboard" && page.period !== "week" ? `${path}?period=${page.period}` : path;
}
