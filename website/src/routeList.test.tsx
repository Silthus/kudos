import { describe, expect, test } from "vitest";
import { routeList, urlOf, type Page } from "../../convex/website/routes";
import { routeOf, servedPaths, type Route } from "./route";

describe("SW10: the route list is the paths the router serves", () => {
  test("Slack links to exactly the paths the website's router serves", () => {
    expect([...routeList].sort()).toEqual([...servedPaths].sort());
  });

  test("WS203: both lists hold /activity", () => {
    expect(routeList).toContain("/activity");
    expect(servedPaths).toContain("/activity");
  });
});

describe("#435: the router reads every target a Slack link carries", () => {
  const origin = "https://kudos-site.test";
  const lastWeeksCrate = { kind: "weekly", week: "2026-10-05", slot: 2 } as const;

  test.each<{ link: string; page: Page; route: Route }>([
    { link: "/quests?quest=2", page: { page: "quests", quest: 2 }, route: { page: "quests", quest: 2 } },
    { link: "/skills?perk=spark", page: { page: "skillTree", perk: "spark" }, route: { page: "skills", perk: "spark" } },
    { link: "/skills?crate=skillTree", page: { page: "skillTree", crate: "skillTree" }, route: { page: "skills", crate: "skillTree" } },
    { link: "/quests?crate=quests", page: { page: "quests", crate: "quests" }, route: { page: "quests", crate: "quests" } },
    { link: "/leaderboard?crate=leaderboard", page: { page: "leaderboard", period: "week", crate: "leaderboard" }, route: { page: "leaderboard", period: "week", crate: "leaderboard" } },
    { link: "/leaderboard?period=month&crate=leaderboard", page: { page: "leaderboard", period: "month", crate: "leaderboard" }, route: { page: "leaderboard", period: "month", crate: "leaderboard" } },
    { link: "/book?crate=book", page: { page: "book", crate: "book" }, route: { page: "book", bookPage: "overview", crate: "book" } },
    { link: "/?crate=journey", page: { page: "home", crate: "journey" }, route: { page: "home", crate: "journey" } },
    { link: "/quests?crate=weekly%3A2026-10-05%3A2", page: { page: "quests", crate: lastWeeksCrate }, route: { page: "quests", crate: lastWeeksCrate } },
  ])("$link", ({ link, page, route }) => {
    const url = urlOf(origin, page);
    expect(url).toBe(`${origin}${link}`);
    expect(routeOf(new URL(url))).toEqual(route);
  });

  test.each(["weekly:2026-10-05", "weekly:2026-10-05:", "weekly:2026-10-05:x", "weekly:last-week:1", "weekly:2026-10-05:1:2", "daily:2026-10-05:1"])("drops a broken weekly crate: ?crate=%s", (crate) => {
    expect(routeOf(new URL(`${origin}/quests?crate=${crate}`))).toEqual({ page: "quests" });
  });
});
