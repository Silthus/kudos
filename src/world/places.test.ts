import { describe, expect, test } from "vitest";
import { navItems, type NavContext } from "@/lib/nav";
import { mapHeight, mapWidth } from "./pixels";
import { placeDistrict } from "../../convex/lib/tree";
import { PLACES, placeAt, placeForPath, routablePlaces, visiblePlaces } from "./places";

const member: NavContext = { isAdmin: false, isDemo: false, storeEnabled: false, openRequests: 0 };
const everything: NavContext = { isAdmin: true, isDemo: true, storeEnabled: true, gameShown: true, openRequests: 3 };
const ids = (places: { id: string }[]) => places.map((p) => p.id).sort();

describe("which places are on the map", () => {
  test("every page in the navigation has a place, named as in the design plan", () => {
    const names = Object.fromEntries(PLACES.map((p) => [p.id, p.name]));
    expect(names).toEqual({
      garden: "Your garden",
      me: "Your cabin",
      quests: "Quest signpost",
      leaderboard: "Notice board",
      compare: "Mirror pond",
      discoveries: "The gallery",
      store: "The store stall",
      skills: "The elder oak",
      analytics: "The observatory",
      admin: "The gatehouse",
      playground: "The sandbox",
    });
    for (const item of navItems(everything)) expect(names).toHaveProperty(item.id);
  });

  test("a plain member sees the places of the always-on pages", () => {
    expect(ids(visiblePlaces(navItems(member)))).toEqual(["analytics", "compare", "discoveries", "leaderboard", "me", "quests"]);
  });

  test("the gatehouse is for admins, the sandbox for the demo, the store stall while the store is open", () => {
    expect(ids(visiblePlaces(navItems({ ...member, isAdmin: true })))).toContain("admin");
    expect(ids(visiblePlaces(navItems({ ...member, isDemo: true })))).toContain("playground");
    expect(ids(visiblePlaces(navItems({ ...member, storeEnabled: true })))).toContain("store");
    for (const hidden of ["admin", "playground", "store"]) expect(ids(visiblePlaces(navItems(member)))).not.toContain(hidden);
  });

  test("your garden and the elder oak are there while the game is shown to you", () => {
    expect(ids(visiblePlaces(navItems(member)))).not.toContain("garden");
    expect(ids(visiblePlaces(navItems({ ...member, gameShown: true })))).toEqual(expect.arrayContaining(["garden", "skills"]));
  });

  test("the quest signpost leaves while quests are switched off", () => {
    expect(ids(visiblePlaces(navItems({ ...member, questsEnabled: false })))).not.toContain("quests");
  });

  test("a place carries its page's link and badge", () => {
    const gatehouse = visiblePlaces(navItems(everything)).find((p) => p.id === "admin")!;
    expect(gatehouse).toMatchObject({ to: "/admin?tab=store", path: "/admin", badge: { count: 3, label: "3 open store requests" } });
  });
});

describe("the place a URL points at", () => {
  const places = visiblePlaces(navItems(everything));

  test.each([
    ["/quests", "quests"],
    ["/leaderboard", "leaderboard"],
    ["/Admin", "admin"],
    ["/compare/anything", "compare"],
    ["/garden", "garden"],
  ])("%s is at %s", (path, id) => {
    expect(placeForPath(path, places)?.place.id).toBe(id);
  });

  test("a teammate's garden is their bed by your garden", () => {
    expect(placeForPath("/garden/m42", places)).toMatchObject({ place: { id: "garden" }, memberId: "m42" });
    expect(placeForPath("/garden", places)?.memberId).toBeUndefined();
  });

  test("a page that opens from a link before it's on the map (the locked store) still has its place", () => {
    const shown = visiblePlaces(navItems(member));
    expect(placeForPath("/store", routablePlaces(shown))?.place).toMatchObject({ id: "store", name: "The store stall", to: "/store" });
    // Visible places keep their nav link and badge.
    expect(routablePlaces(visiblePlaces(navItems(everything))).find((p) => p.id === "admin")?.to).toBe("/admin?tab=store");
  });

  test("the map itself, an unknown path or a hidden place is no place", () => {
    expect(placeForPath("/", places)).toBeNull();
    expect(placeForPath("/nowhere", places)).toBeNull();
    expect(placeForPath("/admin", visiblePlaces(navItems(member)))).toBeNull();
  });
});

describe("every place file", () => {
  test("has a sprite and a door right by its footprint, outside it", () => {
    for (const p of PLACES) {
      expect(mapWidth(p.sprite), p.id).toBeGreaterThan(0);
      expect(mapHeight(p.sprite), p.id).toBeGreaterThan(0);
      const { x, y, w, h } = p.footprint;
      for (const door of p.doors) {
        const inside = door.x >= x && door.x < x + w && door.y >= y && door.y < y + h;
        const touching = door.x >= x - 1 && door.x <= x + w && door.y >= y - 1 && door.y <= y + h;
        expect(p.walkable || !inside, `${p.id} door ${door.x},${door.y}`).toBe(true);
        expect(touching, `${p.id} door ${door.x},${door.y}`).toBe(true);
      }
    }
  });

  test("ids are unique, and each is a place of one of the tree's districts (#156)", () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    for (const p of PLACES) expect(placeDistrict(p.id), p.id).not.toBeNull();
  });

  test("doors are on the building's front (+x or +y side), so the hedgehog stands in front of it", () => {
    // Flat places (the pond, the garden) have no front to hide behind.
    for (const p of PLACES.filter((p) => !p.walkable && p.terrain !== "water")) {
      const { x, y, w, h } = p.footprint;
      for (const d of p.doors) {
        const front = (d.x === x + w && d.y >= y && d.y < y + h) || (d.y === y + h && d.x >= x && d.x < x + w);
        expect(front, `${p.id} door ${d.x},${d.y}`).toBe(true);
      }
    }
  });

  test("a place settles where its district stands: footprint, doors and ground move with it", () => {
    const garden = PLACES.find((p) => p.id === "garden")!;
    const at = placeAt(garden, { x: -12, y: 7 });
    expect(at.footprint).toMatchObject({ x: garden.footprint.x - 12, y: garden.footprint.y + 7 });
    expect(at.doors).toEqual([{ x: -12, y: 7 }]);
    expect(at.ground!(-12, 7)).toBe(garden.ground!(0, 0));
    expect(at.ground!(-9, 7)).toBe("gate");
  });
});
