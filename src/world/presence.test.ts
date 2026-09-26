import { describe, expect, test } from "vitest";
import { layout } from "../../convex/lib/tree";
import { findPath, type Tile } from "./iso";
import { cardFor, cardNudge, glideAt, glideTo, shouldBeat, wanderRoutes, wandererAt, whereIs, type Beat } from "./presence";
import { PLACES } from "./places";
import { buildWorld } from "./world";

const at = (x: number, y: number, patch: Partial<Beat> = {}): Beat => ({ x, y, facing: "right", animation: "idle", ...patch });

describe("the heartbeat's pace", () => {
  test("the first beat goes at once", () => {
    expect(shouldBeat(null, at(4, 4), 0)).toBe(true);
  });

  test("walking, at most 4 beats a second", () => {
    const last = { beat: at(4, 4, { animation: "walk" }), at: 1000 };
    expect(shouldBeat(last, at(5, 4, { animation: "walk" }), 1100)).toBe(false);
    expect(shouldBeat(last, at(5, 4, { animation: "walk" }), 1250)).toBe(true);
  });

  test("standing still, a beat every 20 s and no more", () => {
    const last = { beat: at(4, 4), at: 0 };
    expect(shouldBeat(last, at(4, 4), 19_999)).toBe(false);
    expect(shouldBeat(last, at(4, 4), 20_000)).toBe(true);
  });

  test("a stop or a turn goes on the next tick, however soon", () => {
    const last = { beat: at(5, 4, { animation: "walk" }), at: 1000 };
    expect(shouldBeat(last, at(5, 4, { animation: "idle" }), 1010)).toBe(true);
    expect(shouldBeat(last, at(5, 4, { animation: "walk", facing: "left" }), 1010)).toBe(true);
  });

  test("while the demo resets, only the idle pace", () => {
    const last = { beat: at(4, 4, { animation: "walk" }), at: 0 };
    expect(shouldBeat(last, at(9, 4, { animation: "walk" }), 5000, "slow")).toBe(false);
    expect(shouldBeat(last, at(9, 4, { animation: "walk" }), 20_000, "slow")).toBe(true);
  });
});

describe("another hog glides between the spots it's seen at", () => {
  test("seen for the first time, it stands there", () => {
    const g = glideTo(null, { x: 10, y: 4 }, 1000, false);
    expect(glideAt(g, 1000)).toEqual({ at: { x: 10, y: 4 }, moving: false });
  });

  test("seen a step on, it walks there over the time between the two sightings", () => {
    const first = glideTo(null, { x: 10, y: 4 }, 1000, false);
    const g = glideTo(first, { x: 12, y: 4 }, 1250, false);
    expect(glideAt(g, 1250)).toEqual({ at: { x: 10, y: 4 }, moving: true });
    expect(glideAt(g, 1375)).toEqual({ at: { x: 11, y: 4 }, moving: true });
    expect(glideAt(g, 1500)).toEqual({ at: { x: 12, y: 4 }, moving: false });
  });

  test("a new spot mid-glide carries on from where it is, never jumping back", () => {
    const first = glideTo(null, { x: 0, y: 0 }, 0, false);
    const g = glideTo(first, { x: 4, y: 0 }, 400, false);
    const on = glideTo(g, { x: 4, y: 4 }, 600, false);
    expect(glideAt(on, 600).at).toEqual({ x: 2, y: 0 });
  });

  test("the same spot again changes nothing", () => {
    const first = glideTo(null, { x: 0, y: 0 }, 0, false);
    const g = glideTo(first, { x: 4, y: 0 }, 400, false);
    expect(glideTo(g, { x: 4, y: 0 }, 500, false)).toBe(g);
  });

  test("a long gap between sightings still glides briskly, at most 0.8 s", () => {
    const first = glideTo(null, { x: 0, y: 0 }, 0, false);
    const g = glideTo(first, { x: 2, y: 0 }, 20_000, false);
    expect(glideAt(g, 20_800)).toEqual({ at: { x: 2, y: 0 }, moving: false });
  });

  test("under reduced motion, or seen far away (a reload elsewhere), it appears there", () => {
    const first = glideTo(null, { x: 0, y: 0 }, 0, false);
    expect(glideAt(glideTo(first, { x: 2, y: 0 }, 250, true), 250)).toEqual({ at: { x: 2, y: 0 }, moving: false });
    expect(glideAt(glideTo(first, { x: 40, y: 0 }, 250, false), 250)).toEqual({ at: { x: 40, y: 0 }, moving: false });
  });
});

describe("where someone is, for the online list", () => {
  const world = buildWorld({ seed: 1, layout: layout(1, 20_000), planted: true, standing: PLACES.map((p) => p.id) });

  test("at the tree's foot, base camp, as far as its sandbox and your cabin", () => {
    expect(whereIs(world, world.spawn)).toBe("Base camp");
    for (const id of ["playground", "me"]) expect(whereIs(world, world.places.find((p) => p.id === id)!.doors[0]), id).toBe("Base camp");
  });

  test("in or by an open district, the district's name", () => {
    const signpost = world.sites.find((s) => s.id === "signpost")!;
    expect(whereIs(world, signpost.approach)).toBe("The signpost");
    const terrace = world.sites.find((s) => s.id === "terrace")!;
    expect(whereIs(world, terrace.at)).toBe("The terraces");
  });

  test("at a ruin, the ruin; out in the sand, the desert", () => {
    const ruin = world.ruins[0];
    expect(whereIs(world, ruin.at)).toBe(ruin.name);
    expect(whereIs(world, { x: 300, y: -300 })).toBe("The desert");
  });
});

describe("a hog's card", () => {
  const ana = { memberId: "m2", name: "Ana Lima", title: "Gardener", hasHome: false };
  const viewer = { memberId: "m1", workspaceName: "Lumen Labs", sharedDemo: false };

  test("a teammate: their name, level title, and a way to their garden", () => {
    expect(cardFor(ana, viewer)).toEqual({ name: "Ana Lima", title: "Gardener", note: null, actions: [{ label: "Visit their garden", to: "/garden/m2" }] });
  });

  test("with a home, a way to it too", () => {
    expect(cardFor({ ...ana, hasHome: true }, viewer).actions).toEqual([
      { label: "Visit their garden", to: "/garden/m2" },
      { label: "Visit their home", to: "/home/m2" },
    ]);
  });

  test("a wandering teammate in the demo says so", () => {
    expect(cardFor({ ...ana, npc: true }, { ...viewer, sharedDemo: true }).note).toBe("Lumen Labs teammate");
  });

  test("another visitor to the shared demo walks as you: their garden is yours", () => {
    const card = cardFor({ ...ana, memberId: "m1", name: "Alex Rivera" }, { ...viewer, sharedDemo: true });
    expect(card.note).toBe("Another visitor exploring the demo");
    expect(card.actions).toEqual([{ label: "Visit the garden", to: "/garden" }]);
  });
});

test("a card near the screen's edge moves in to stay whole, 8 px clear", () => {
  expect(cardNudge(100, 340, 390)).toBe(0);
  expect(cardNudge(300, 540, 390)).toBe(-158);
  expect(cardNudge(-40, 200, 390)).toBe(48);
});

describe("the demo's wandering teammates", () => {
  const team = [
    { memberId: "m2", name: "Ana Lima" },
    { memberId: "m3", name: "Ben Okafor" },
    { memberId: "m4", name: "Chen Wu" },
  ];
  const stops: Tile[] = [
    { x: 4, y: 4 },
    { x: 14, y: 2 },
    { x: -6, y: 12 },
    { x: 10, y: -10 },
    { x: 0, y: 18 },
  ];
  const open = { walkable: () => true };
  const walk = (a: Tile, b: Tile) => findPath(open, a, b);

  test("the same day is the same walk for everyone who looks", () => {
    expect(wanderRoutes("2026-09-26", team, stops, walk)).toEqual(wanderRoutes("2026-09-26", team, stops, walk));
  });

  test("another day, another walk", () => {
    const today = wanderRoutes("2026-09-26", team, stops, walk);
    const tomorrow = wanderRoutes("2026-09-27", team, stops, walk);
    expect(tomorrow.map((r) => r.legs.map((l) => l.path[0]))).not.toEqual(today.map((r) => r.legs.map((l) => l.path[0])));
  });

  test("each stands a while at a stop, then strolls tile by tile to the next", () => {
    for (const route of wanderRoutes("2026-09-26", team, stops, walk)) {
      const leg = route.legs[0];
      const dwelling = wandererAt(route, route.offsetMs === 0 ? 0 : route.cycleMs - route.offsetMs + leg.startMs);
      expect(dwelling).toMatchObject({ at: leg.path[0], animation: "idle" });
      const halfway = wandererAt(route, (route.cycleMs - route.offsetMs + leg.startMs + leg.dwellMs + leg.walkMs / 2) % route.cycleMs);
      expect(halfway.animation).toBe("walk");
      const tile = { x: Math.round(halfway.at.x), y: Math.round(halfway.at.y) };
      expect(leg.path.some((t) => Math.abs(t.x - tile.x) + Math.abs(t.y - tile.y) <= 1)).toBe(true);
      expect(stops).toContainEqual(leg.path[0]);
    }
  });

  test("under reduced motion it never strolls: it stands at a stop, then at the next", () => {
    const [route] = wanderRoutes("2026-09-26", team, stops, walk);
    const leg = route.legs[0];
    const walking = (route.cycleMs - route.offsetMs + leg.startMs + leg.dwellMs + leg.walkMs / 2) % route.cycleMs;
    expect(wandererAt(route, walking, true)).toMatchObject({ at: leg.path.at(-1), animation: "idle" });
  });

  test("a whole day loops: any moment has a place, however late", () => {
    const [route] = wanderRoutes("2026-09-26", team, stops, walk);
    expect(wandererAt(route, 86_399_999).at).toEqual(wandererAt(route, 86_399_999 % route.cycleMs).at);
  });

  test("a stop nobody can walk to is left out; with nowhere to go, nobody wanders", () => {
    const walled = (a: Tile, b: Tile) => (b.x === 14 && b.y === 2 ? null : walk(a, b));
    for (const route of wanderRoutes("2026-09-26", team, stops, walled)) for (const leg of route.legs) expect(leg.path).not.toContainEqual({ x: 14, y: 2 });
    expect(wanderRoutes("2026-09-26", team, [{ x: 4, y: 4 }], walk)).toEqual([]);
  });
});
