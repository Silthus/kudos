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

export function routeOf(page: Page): string {
  const path = pathOf[page.page];
  if (!routeList.includes(path)) return pathOf.home;
  return page.page === "leaderboard" && page.period !== "week" ? `${path}?period=${page.period}` : path;
}
