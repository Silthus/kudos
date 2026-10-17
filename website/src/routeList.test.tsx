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

  test("#467: both lists hold /book/collection", () => {
    expect(routeList).toContain("/book/collection");
    expect(servedPaths).toContain("/book/collection");
    expect(routeOf(new URL("https://kudos-site.test/book/collection"))).toEqual({ page: "book", bookPage: "collection" });
  });
});

describe("#435: the router reads every target a Slack link carries", () => {
  const origin = "https://kudos-site.test";
  const lastWeeksCrate = { kind: "weekly", week: "2026-10-05", slot: 2 } as const;
  const secondBoughtCrate = { kind: "bought", n: 2 } as const;
  const lastWeeksGroupCrate = { kind: "group", week: "2026-10-05" } as const;

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
    { link: "/book/collection?crate=bought%3A2", page: { page: "bookCollection", crate: secondBoughtCrate }, route: { page: "book", bookPage: "collection", crate: secondBoughtCrate } },
    { link: "/book/collection?crate=store", page: { page: "bookCollection", crate: "store" }, route: { page: "book", bookPage: "collection", crate: "store" } },
    { link: "/quests?crate=group%3A2026-10-05", page: { page: "quests", crate: lastWeeksGroupCrate }, route: { page: "quests", crate: lastWeeksGroupCrate } },
    { link: "/?panel=inventory", page: { page: "home", panel: "inventory" }, route: { page: "home", panel: "inventory" } },
    { link: "/settings?section=visibility", page: { page: "settings", section: "visibility" }, route: { page: "settings", section: "visibility" } },
    { link: "/settings?section=messages", page: { page: "settings", section: "messages" }, route: { page: "settings", section: "messages" } },
    { link: "/settings?section=group", page: { page: "settings", section: "group" }, route: { page: "settings", section: "group" } },
    { link: "/settings?section=company-profile", page: { page: "settings", section: "company-profile" }, route: { page: "settings", section: "company-profile" } },
    { link: "/settings?section=admin", page: { page: "settings", section: "admin" }, route: { page: "settings", section: "admin" } },
    { link: "/settings?section=workspace", page: { page: "settings", section: "workspace" }, route: { page: "settings", section: "workspace" } },
  ])("$link", ({ link, page, route }) => {
    const url = urlOf(origin, page);
    expect(url).toBe(`${origin}${link}`);
    expect(routeOf(new URL(url))).toEqual(route);
  });

  test.each(["weekly:2026-10-05", "weekly:2026-10-05:", "weekly:2026-10-05:x", "weekly:last-week:1", "weekly:2026-10-05:1:2", "daily:2026-10-05:1"])("drops a broken weekly crate: ?crate=%s", (crate) => {
    expect(routeOf(new URL(`${origin}/quests?crate=${crate}`))).toEqual({ page: "quests" });
  });

  test.each(["bought", "bought:", "bought:x", "bought:-1", "bought:0", "bought:1.5", "bought:1:2", "bought:1000000000000000000000", "sold:1"])("#469: drops a broken bought crate: ?crate=%s", (crate) => {
    expect(routeOf(new URL(`${origin}/book/collection?crate=${crate}`))).toEqual({ page: "book", bookPage: "collection" });
  });

  test.each([1.5, 0, -1, 1e21])("#469: the link function writes no target for a bought crate numbered %s, so both sides agree", (n) => {
    expect(urlOf(origin, { page: "bookCollection", crate: { kind: "bought", n } })).toBe(`${origin}/book/collection`);
  });

  test.each(["group:", "group:last-week", "group:2026-10-05:1", "group:2026-10-5", "groups:2026-10-05"])("drops a broken group crate: ?crate=%s", (crate) => {
    expect(routeOf(new URL(`${origin}/quests?crate=${crate}`))).toEqual({ page: "quests" });
  });
});

describe("#585: the Book's spread is read from the hash", () => {
  test.each<[string, Route]>([
    ["/book#cover", { page: "book", bookPage: "overview", spread: { kind: "cover" } }],
    ["/book#hoggies", { page: "book", bookPage: "overview", spread: { kind: "hoggies", rarity: "legendary" } }],
    ["/book#hoggies/rare", { page: "book", bookPage: "overview", spread: { kind: "hoggies", rarity: "rare" } }],
    ["/book#hoggies/bogus", { page: "book", bookPage: "overview", spread: { kind: "hoggies", rarity: "legendary" } }],
    ["/book#teams", { page: "book", bookPage: "overview", spread: { kind: "teams" } }],
    ["/book#teams/people-ops", { page: "book", bookPage: "overview", spread: { kind: "team", team: "people-ops" } }],
    ["/book#teams/group:platform", { page: "book", bookPage: "overview", spread: { kind: "team", team: "group:platform" } }],
    ["/book#achievements", { page: "book", bookPage: "overview", spread: { kind: "achievements", category: "all" } }],
    ["/book?page=giving#achievements/crowd", { page: "book", bookPage: "giving", spread: { kind: "achievements", category: "crowd" } }],
    ["/book/collection#hoggies/epic", { page: "book", bookPage: "collection", spread: { kind: "hoggies", rarity: "epic" } }],
    ["/book/collection?crate=store#teams", { page: "book", bookPage: "collection", crate: "store", spread: { kind: "teams" } }],
    ["/book#nonsense", { page: "book", bookPage: "overview" }],
    ["/book", { page: "book", bookPage: "overview" }],
  ])("reads %s", (path, route) => {
    expect(routeOf(new URL(`${origin}${path}`))).toEqual(route);
  });

  test("a hash on another page is ignored", () => {
    expect(routeOf(new URL(`${origin}/quests#hoggies/rare`))).toEqual({ page: "quests" });
  });
});
