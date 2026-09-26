import { describe, expect, test } from "vitest";
import {
  DISTRICT_BY_ID,
  TREE_STAGES,
  layout,
  type Layout,
} from "../../convex/lib/tree";
import { findPath, sameTile, type Tile } from "./iso";
import { PLACES } from "./places";
import { BEDS, PLOTS } from "./places/garden";
import { buildWorld, settle, underCanopy, type World } from "./world";

/**
 * The world on the tree (#156): the desert with the tree at the origin, and the districts the
 * server's layout (`api.tree.state().layout`) puts round it, open ones standing, closed ones dry
 * outlines in the sand.
 */

const ALL = PLACES.map((p) => p.id);
const key = (t: Tile) => `${t.x},${t.y}`;
const world = (seed: number, growth: number, planted = true, standing = ALL) =>
  buildWorld({
    seed,
    layout: layout(seed, growth),
    peakGrowth: growth,
    planted,
    standing,
  });
const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2_654_435_761) >>> 0);

describe("the districts on the tree", () => {
  test("every open door is reachable on foot from base camp, on every tree, at every stage", () => {
    for (const seed of SEEDS)
      for (const stage of TREE_STAGES) {
        const w = world(seed, stage.growth);
        for (const p of w.places)
          for (const door of p.doors)
            expect(
              findPath(w, w.spawn, door),
              `${seed} ${stage.id}: ${p.id} at ${key(door)}`,
            ).not.toBeNull();
      }
  });

  test("so is every ruin entrance and every closed district's outline, to walk up to it", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const w = world(seed, 20_000);
      for (const r of w.ruins)
        expect(findPath(w, w.spawn, r.at), `${seed} ${r.name}`).not.toBeNull();
      const young = world(seed, 30);
      for (const s of young.sites.filter((s) => !s.open))
        expect(
          findPath(young, young.spawn, s.approach),
          `${seed} ${s.id}`,
        ).not.toBeNull();
    }
  });

  test("no two districts overlap, nor a district and the tree, on any tree", () => {
    for (const seed of SEEDS) {
      const w = world(seed, 20_000);
      const taken = new Map<string, string>();
      for (const s of w.sites)
        for (const c of s.claims)
          for (let y = c.y0; y <= c.y1; y++)
            for (let x = c.x0; x <= c.x1; x++) {
              expect(
                taken.get(`${x},${y}`),
                `${seed}: ${s.id} over ${taken.get(`${x},${y}`)} at ${x},${y}`,
              ).toBeUndefined();
              taken.set(`${x},${y}`, s.id);
            }
    }
  });

  test("the tree never hides a place: no district stands where the canopy will be, even at the world tree", () => {
    for (const seed of SEEDS)
      for (const s of settle(layout(seed, 20_000)))
        for (const c of s.id === "base_camp" ? [] : s.claims)
          for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) expect(underCanopy(x, y), `${seed} ${s.id} at ${x},${y}`).toBe(false);
  });

  test("a district stands at its anchor from the layout, or a few steps off it where a neighbour or the canopy is in the way", () => {
    for (const seed of SEEDS) {
      const l = layout(seed, 20_000);
      for (const s of settle(l)) {
        const anchor = l.districts.find((d) => d.id === s.id)!.at;
        expect(
          Math.hypot(s.at.x - anchor.x, s.at.y - anchor.y),
          `${seed} ${s.id}`,
        ).toBeLessThanOrEqual(16);
      }
    }
    // Far apart, nothing moves: the stall's footprint is its file's, moved to its anchor.
    const spaced: Layout = {
      ...layout(1, 20_000),
      districts: layout(1, 20_000).districts.map((d, i) =>
        d.id === "base_camp"
          ? d
          : {
              ...d,
              at: { x: 20 * (i % 5) - 40, y: 60 + 20 * Math.floor(i / 5) },
            },
      ),
    };
    const stall = spaced.districts.find((d) => d.id === "stall")!;
    const placed = buildWorld({
      seed: 1,
      layout: spaced,
      peakGrowth: 20_000,
      planted: true,
      standing: ALL,
    }).places.find((p) => p.id === "store")!;
    const def = PLACES.find((p) => p.id === "store")!;
    expect(placed.footprint).toEqual({
      ...def.footprint,
      x: def.footprint.x + stall.at.x,
      y: def.footprint.y + stall.at.y,
    });
  });

  test("a place never moves as the tree grows: once settled, it keeps its tiles at every later stage", () => {
    for (const seed of SEEDS) {
      const at = new Map<string, string>();
      for (const stage of TREE_STAGES)
        for (const s of settle(layout(seed, stage.growth))) {
          const was = at.get(s.id);
          if (was)
            expect(key(s.at), `${seed} ${s.id} at ${stage.id}`).toBe(was);
          at.set(s.id, key(s.at));
        }
    }
  });

  test("open districts' places stand; closed ones are dry outlines you can walk over, saying how much more the tree needs", () => {
    const w = world(5, 30); // a sapling: the stall is closed
    expect(w.places.map((p) => p.id).sort()).toEqual([
      "discoveries",
      "garden",
      "leaderboard",
      "me",
      "playground",
      "quests",
    ]);
    const stall = w.sites.find((s) => s.id === "stall")!;
    expect(stall).toMatchObject({
      open: false,
      name: DISTRICT_BY_ID.stall.name,
      opens: "young",
      toOpen: 70,
    });
    for (let y = stall.claim.y0 + 1; y < stall.claim.y1; y++)
      for (let x = stall.claim.x0 + 1; x < stall.claim.x1; x++)
        expect(w.walkable(x, y), `${x},${y}`).toBe(true);
    expect(w.outlineAt(stall.outline.x0, stall.outline.y0)).toBe("closed");
    // At the young stage it stands, and its footprint is in the way.
    const grown = world(5, 100);
    const store = grown.places.find((p) => p.id === "store")!;
    expect(grown.walkable(store.footprint.x, store.footprint.y)).toBe(false);
  });

  test("only the places on this viewer's map stand: the gatehouse is lawn for a member who isn't an admin", () => {
    const admin = world(3, 400);
    const member = world(
      3,
      400,
      true,
      ALL.filter((id) => id !== "admin"),
    );
    const gate = admin.places.find((p) => p.id === "admin")!;
    expect(member.places.some((p) => p.id === "admin")).toBe(false);
    expect(member.walkable(gate.footprint.x, gate.footprint.y)).toBe(true);
    expect(admin.walkable(gate.footprint.x, gate.footprint.y)).toBe(false);
  });

  test("a path leads from base camp to each door, so the way there is a walk along paths", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const w = world(seed, 400);
      for (const p of w.places.filter((p) => p.id !== "me")) {
        const walk = findPath(w, w.spawn, p.doors[0])!;
        const onPath = walk.filter((t) =>
          ["path", "gate"].includes(w.terrainAt(t.x, t.y)),
        ).length;
        expect(onPath / walk.length, `${seed} ${p.id}`).toBeGreaterThan(0.6);
      }
    }
  });
});

describe("the tree and base camp", () => {
  test("the tree stands at the origin, in the way; before the seed is planted there's no tree, only base camp", () => {
    const w = world(9, 400);
    expect(w.walkable(0, 0)).toBe(false);
    expect(w.trunk).toEqual({ x0: -1, y0: -1, x1: 1, y1: 1 });
    const bare = world(9, 0, false);
    expect(bare.trunk).toBeNull();
    expect(bare.places.map((p) => p.id).sort()).toEqual(["me", "playground"]);
    expect(bare.terrainAt(0, 0)).not.toBe("lawn");
  });

  test("you start in base camp, at the tree's foot by the offering stone", () => {
    const w = world(9, 400);
    expect(Math.hypot(w.spawn.x, w.spawn.y)).toBeLessThan(8);
    expect(w.walkable(w.spawn.x, w.spawn.y)).toBe(true);
    expect(w.props.map((p) => p.kind)).toContain("stone");
  });

  test("the tree greens the desert round its foot, more the bigger it grows", () => {
    const lawn = (w: World) => {
      let n = 0;
      for (let y = -30; y <= 30; y++)
        for (let x = -30; x <= 30; x++) if (w.terrainAt(x, y) === "lawn") n++;
      return n;
    };
    const sizes = TREE_STAGES.map((s) => lawn(world(4, s.growth)));
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i], TREE_STAGES[i].id).toBeGreaterThan(sizes[i - 1]);
    expect(["sand", "dune", "ridge"]).toContain(world(4, 400).terrainAt(0, 30));
  });
});

describe("your garden on the terrace", () => {
  test("your key beds and the neighbours' beds are the terrace's, where the layout put it", () => {
    const w = world(11, 400);
    const at = w.sites.find((s) => s.id === "terrace")!.at;
    expect(w.plots).toEqual(
      PLOTS.map((t) => ({ x: t.x + at.x, y: t.y + at.y })),
    );
    expect(w.beds).toEqual(BEDS.map((t) => ({ x: t.x + at.x, y: t.y + at.y })));
    expect(w.beds.length).toBeGreaterThanOrEqual(12);
    for (const t of [...w.plots, ...w.beds])
      expect(findPath(w, w.spawn, t), key(t)).not.toBeNull();
    const garden = w.places.find((p) => p.id === "garden")!;
    expect(sameTile(garden.doors[0], at)).toBe(true);
  });

  test("before the terrace opens, or with the game hidden, there are no plots or beds", () => {
    expect(world(11, 10).plots).toEqual([]);
    expect(
      world(
        11,
        400,
        true,
        ALL.filter((id) => id !== "garden"),
      ).beds,
    ).toEqual([]);
  });
});
