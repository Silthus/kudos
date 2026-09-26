import { describe, expect, test } from "vitest";
import { CREW_PARTS } from "../../../convex/lib/crewCatalogue";
import { layout, TREE_STAGE_BY_ID } from "../../../convex/lib/tree";
import { findPath, type Tile } from "../iso";
import { PLACES } from "../places";
import { buildWorld, inRect, underCanopy } from "../world";
import { cosmeticsKey, treeCosmetics, type TreeCosmetics } from "./cosmetics";

/** What the crew built, drawn in the world (#161): structures by their districts, styles on their ground. */

const ALL = PLACES.map((p) => p.id);
const SEEDS = Array.from({ length: 30 }, (_, i) => (i * 2_654_435_761) >>> 0);
const EVERY_STRUCTURE = treeCosmetics(CREW_PARTS.filter((p) => p.kind === "structure").map((p) => ({ part: p.id })));
const world = (seed: number, growth: number, cosmetics: TreeCosmetics) => buildWorld({ seed, layout: layout(seed, growth), planted: true, standing: ALL, cosmetics });

describe("what the crew built, read from the tree", () => {
  test("each kind of part lands where the world draws it; a part or option this client doesn't know is left out", () => {
    const c = treeCosmetics([
      { part: "structure_bell" },
      { part: "style_stall", option: "blossom" },
      { part: "style_pool", option: "neon" },
      { part: "canopy_colour", option: "rose" },
      { part: "banner", text: "Thanks make the tree grow" },
      { part: "statue", option: "reader" },
      { part: "structure_hovercraft" },
    ]);
    expect(c).toEqual({
      structures: [{ id: "structure_bell", district: "base_camp" }],
      styles: [{ district: "stall", style: "blossom" }],
      canopy: "rose",
      banner: "Thanks make the tree grow",
      statue: "reader",
    });
    expect(cosmeticsKey(c)).not.toBe(cosmeticsKey(treeCosmetics([])));
  });
});

describe("structures stand by their districts", () => {
  test("each built structure stands on its own tile near its open district, never on a door or under the canopy, and every door stays reachable", () => {
    for (const seed of SEEDS) {
      const w = world(seed, TREE_STAGE_BY_ID.world_tree.growth, EVERY_STRUCTURE);
      expect(w.crew.props.map((p) => p.id).sort(), `${seed}`).toEqual(EVERY_STRUCTURE.structures.map((s) => s.id).sort());
      const doors = w.places.flatMap((p) => p.doors);
      const taken = new Set<string>();
      for (const prop of w.crew.props) {
        const k = `${prop.tile.x},${prop.tile.y}`;
        expect(taken.has(k), `${seed} ${prop.id} shares ${k}`).toBe(false);
        taken.add(k);
        expect(w.walkable(prop.tile.x, prop.tile.y), `${seed} ${prop.id} is in the way`).toBe(false);
        expect(doors.some((d: Tile) => d.x === prop.tile.x && d.y === prop.tile.y)).toBe(false);
        expect(underCanopy(prop.tile.x, prop.tile.y), `${seed} ${prop.id} under the canopy`).toBe(false);
        const site = w.sites.find((s) => s.id === prop.district)!;
        const near = { x0: site.claim.x0 - 4, y0: site.claim.y0 - 4, x1: site.claim.x1 + 4, y1: site.claim.y1 + 4 };
        expect(inRect(near, prop.tile.x, prop.tile.y), `${seed} ${prop.id} far from ${site.id}`).toBe(true);
      }
      for (const p of w.places) for (const door of p.doors) expect(findPath(w, w.spawn, door), `${seed}: ${p.id}`).not.toBeNull();
    }
  });

  test("a structure whose district hasn't opened waits: nothing stands in the sand", () => {
    const w = world(SEEDS[0], TREE_STAGE_BY_ID.great.growth, EVERY_STRUCTURE);
    // The root stair is the near ruins', open at great; the stargazer deck the observatory's, open since grown.
    expect(w.crew.props.map((p) => p.id)).toContain("structure_root_stair");
    const young = world(SEEDS[0], TREE_STAGE_BY_ID.young.growth, EVERY_STRUCTURE);
    expect(young.crew.props.map((p) => p.id)).not.toContain("structure_stargazer_deck");
  });
});

describe("district styles dress their ground", () => {
  test("a styled district's ground reads its style round its places, and nowhere else", () => {
    const seed = SEEDS[3];
    const w = world(seed, TREE_STAGE_BY_ID.elder.growth, treeCosmetics([{ part: "style_stall", option: "crystal" }]));
    const stall = w.sites.find((s) => s.id === "stall")!;
    const door = stall.places[0].doors[0];
    expect(w.crew.styleAt(door.x, door.y)).toBe("crystal");
    const pool = w.sites.find((s) => s.id === "pool")!;
    expect(w.crew.styleAt(pool.places[0].doors[0].x, pool.places[0].doors[0].y)).toBeNull();
    expect(w.crew.styleAt(200, 200)).toBeNull();
  });

  test("the homes' style dresses the plots on the ring", () => {
    const seed = SEEDS[4];
    const w = world(seed, TREE_STAGE_BY_ID.elder.growth, treeCosmetics([{ part: "style_homes", option: "lantern" }]));
    const plot = w.homes.find((h) => h !== null)!;
    expect(w.crew.styleAt(plot.x, plot.y)).toBe("lantern");
  });
});
