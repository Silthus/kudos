import { describe, expect, test } from "vitest";
import { navGroups, navItems, type NavContext } from "./nav";

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

  test("the offering stone, the skill tree and the garden are there while the game is shown to you, after the quest log", () => {
    expect(ids(navItems(member))).not.toContain("skills");
    expect(ids(navItems(member))).not.toContain("garden");
    expect(ids(navItems({ ...member, gameShown: true }))).toEqual(["me", "discoveries", "quests", "offering", "skills", "garden", "leaderboard", "compare", "analytics"]);
    expect(navItems({ ...member, gameShown: true }).find((i) => i.id === "garden")).toMatchObject({ to: "/garden", label: "Garden", short: "Garden" });
    expect(navItems({ ...member, gameShown: true }).find((i) => i.id === "skills")).toMatchObject({ to: "/skills", label: "Skill tree", short: "Skills" });
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

