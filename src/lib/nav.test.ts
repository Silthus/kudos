import { describe, expect, test } from "vitest";
import { Star } from "lucide-react";
import { mobileNav, navGroups, navItems, type NavContext, type NavItem } from "./nav";

const member: NavContext = { isAdmin: false, isDemo: false, storeEnabled: false, openRequests: 0 };
const everything: NavContext = { isAdmin: true, isDemo: true, storeEnabled: true, openRequests: 3 };
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("navItems", () => {
  test("a plain member sees the always-on pages", () => {
    expect(ids(navItems(member))).toEqual(["me", "discoveries", "quests", "leaderboard", "compare", "analytics"]);
  });

  test("store, playground and admin appear only when their condition holds", () => {
    expect(ids(navItems(everything))).toEqual(["me", "discoveries", "quests", "store", "leaderboard", "compare", "analytics", "playground", "admin"]);
    expect(ids(navItems({ ...member, storeEnabled: true }))).toContain("store");
    expect(ids(navItems({ ...member, isDemo: true }))).toContain("playground");
    expect(ids(navItems({ ...member, isAdmin: true }))).toContain("admin");
  });

  test("the quest log hides while quests are switched off; undefined means on", () => {
    expect(ids(navItems({ ...member, questsEnabled: false }))).not.toContain("quests");
    expect(ids(navItems({ ...member, questsEnabled: true }))).toContain("quests");
    expect(ids(navItems({ ...member, questsEnabled: undefined }))).toContain("quests");
  });

  test("admin carries the open store requests as a badge and links straight to them", () => {
    const admin = navItems(everything).find((i) => i.id === "admin")!;
    expect(admin.badge).toEqual({ count: 3, label: "3 open store requests" });
    expect(admin.to).toBe("/admin?tab=store");

    const idle = navItems({ ...everything, openRequests: 0 }).find((i) => i.id === "admin")!;
    expect(idle.badge).toBeUndefined();
    expect(idle.to).toBe("/admin");

    expect(navItems({ ...everything, openRequests: 1 }).find((i) => i.id === "admin")!.badge?.label).toBe("1 open store request");
  });

  test("the server caps open requests at 100, which reads as 99+", () => {
    expect(navItems({ ...everything, openRequests: 100 }).find((i) => i.id === "admin")!.badge).toEqual({ count: 100, label: "99+ open store requests" });
  });
});

describe("navGroups", () => {
  test("groups items as You / Team / Workspace, dropping empty groups", () => {
    expect(navGroups(navItems(everything)).map((g) => [g.label, ids(g.items)])).toEqual([
      ["You", ["me", "discoveries", "quests", "store"]],
      ["Team", ["leaderboard", "compare", "analytics"]],
      ["Workspace", ["playground", "admin"]],
    ]);
    expect(navGroups(navItems(member)).map((g) => g.label)).toEqual(["You", "Team"]);
  });
});

describe("mobileNav", () => {
  test("four primary tabs, everything else in More", () => {
    const nav = mobileNav(navItems(everything), "/me");
    expect(ids(nav.tabs)).toEqual(["me", "leaderboard", "quests", "discoveries"]);
    expect(nav.more.map((g) => [g.label, ids(g.items)])).toEqual([
      ["You", ["store"]],
      ["Team", ["compare", "analytics"]],
      ["Workspace", ["playground", "admin"]],
    ]);
  });

  test("with quests off the next page takes the free tab", () => {
    expect(ids(mobileNav(navItems({ ...member, questsEnabled: false }), "/me").tabs)).toEqual(["me", "leaderboard", "discoveries", "compare"]);
  });

  test("an active page that lives in More takes the last tab, so it stays visible", () => {
    const nav = mobileNav(navItems(everything), "/admin");
    expect(ids(nav.tabs)).toEqual(["me", "leaderboard", "quests", "admin"]);
    expect(ids(nav.more.flatMap((g) => g.items))).toEqual(["discoveries", "store", "compare", "analytics", "playground"]);
  });

  test("matching ignores the query and covers nested paths", () => {
    expect(ids(mobileNav(navItems(everything), "/compare/anything").tabs)).toContain("compare");
    expect(ids(mobileNav(navItems(everything), "/me").tabs)).not.toContain("compare");
    expect(ids(mobileNav(navItems(everything), "/comparex").tabs)).not.toContain("compare");
  });

  test("matching ignores case, like the router does", () => {
    expect(ids(mobileNav(navItems(everything), "/Admin").tabs)).toContain("admin");
  });

  test("a page without a tab priority never pushes the ranked ones aside", () => {
    const extra: NavItem = { id: "new-page", to: "/new", path: "/new", label: "New page", short: "New", icon: Star, group: "team" };
    expect(ids(mobileNav([extra, ...navItems(everything)], "/me").tabs)).toEqual(["me", "leaderboard", "quests", "discoveries"]);
  });

  test("More counts the badges hidden inside it", () => {
    expect(mobileNav(navItems(everything), "/me").moreBadge).toEqual({ count: 3, label: "3 open store requests" });
    // Once Admin is a tab, its badge shows there and More has nothing to add.
    expect(mobileNav(navItems(everything), "/admin").moreBadge).toBeUndefined();
  });

  test("More adds up several hidden badges and names each", () => {
    const flagged: NavItem = { id: "flags", to: "/flags", path: "/flags", label: "Flags", short: "Flags", icon: Star, group: "workspace", badge: { count: 2, label: "2 flagged kudos" } };
    expect(mobileNav([...navItems(everything), flagged], "/me").moreBadge).toEqual({ count: 5, label: "3 open store requests, 2 flagged kudos" });
  });

  test("with four items or fewer there is no More at all", () => {
    const four = navItems(member).slice(0, 4);
    const nav = mobileNav(four, "/me");
    expect(ids(nav.tabs)).toEqual(["me", "leaderboard", "quests", "discoveries"]);
    expect(nav.more).toEqual([]);
  });
});
