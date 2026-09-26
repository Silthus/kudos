import { describe, expect, test } from "vitest";
import {
  DISTRICTS,
  districtsOpen,
  layout,
  placeDistrict,
  ringsForSap,
  sapForKudos,
  STAGES,
  stageForSap,
  stageIndex,
  sapToNext,
  TREE_ORIGIN,
  type StageId,
} from "./tree";

/** The Ancient Tree's pure rules (#152 S1): stages by sap, districts by stage, a seeded layout. */

describe("stages by sap", () => {
  test("follow the spec's thresholds and are monotonic", () => {
    const ids = STAGES.map((s) => s.id);
    expect(ids).toEqual(["seed", "sprout", "sapling", "young", "grown", "great", "ancient", "elder", "world_tree"]);
    expect(STAGES.map((s) => s.sap)).toEqual([0, 5, 25, 100, 300, 800, 2000, 5000, 12000]);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].sap).toBeGreaterThan(STAGES[i - 1].sap);
  });

  test("a stage is reached exactly at its threshold", () => {
    expect(stageForSap(0)).toBe("seed");
    expect(stageForSap(4)).toBe("seed");
    expect(stageForSap(5)).toBe("sprout");
    expect(stageForSap(2000)).toBe("ancient");
    expect(stageForSap(11_999)).toBe("elder");
    expect(stageForSap(12_000)).toBe("world_tree");
    expect(stageForSap(1_000_000)).toBe("world_tree");
  });

  test("sap to the next stage counts down and is null at the top", () => {
    expect(sapToNext(0)).toEqual({ next: "sprout", sap: 5 });
    expect(sapToNext(60)).toEqual({ next: "young", sap: 40 });
    expect(sapToNext(12_000)).toBeNull();
  });

  test("rings grow forever past the world tree, one per 10,000 sap", () => {
    expect(ringsForSap(0)).toBe(0);
    expect(ringsForSap(11_999)).toBe(0);
    expect(ringsForSap(12_000)).toBe(0);
    expect(ringsForSap(22_000)).toBe(1);
    expect(ringsForSap(52_000)).toBe(4);
  });

  test("negative sap (after revokes) is the seed with nothing owed", () => {
    expect(stageForSap(-3)).toBe("seed");
    expect(sapToNext(-3)).toEqual({ next: "sprout", sap: 8 });
  });
});

describe("sap from kudos", () => {
  test("a qualifying kudos gives 1 sap per recipient, never doubled, never for thin kudos", () => {
    expect(sapForKudos({ qualifying: true, recipients: 2 })).toBe(2);
    expect(sapForKudos({ qualifying: false, recipients: 3 })).toBe(0);
    expect(sapForKudos({ qualifying: true, recipients: 1, bonusDay: true })).toBe(1);
  });
});

describe("districts", () => {
  test("open cumulatively by stage, in the spec's order", () => {
    expect(districtsOpen("seed")).toEqual(["base_camp"]);
    expect(districtsOpen("sprout")).toEqual(["base_camp", "signpost", "notice_board"]);
    expect(districtsOpen("sapling")).toContain("terrace");
    expect(districtsOpen("sapling")).toContain("gallery");
    expect(districtsOpen("young")).toEqual(expect.arrayContaining(["stall", "oak", "pool"]));
    expect(districtsOpen("grown")).toEqual(expect.arrayContaining(["homes", "observatory", "gatehouse"]));
    expect(districtsOpen("great")).toEqual(expect.arrayContaining(["near_ruins", "crew"]));
    expect(districtsOpen("ancient")).toEqual(expect.arrayContaining(["far_ruins", "blight"]));
    expect(districtsOpen("elder")).toEqual(expect.arrayContaining(["deep_ruins", "overview"]));
    expect(districtsOpen("world_tree")).toContain("canopy");
    expect(districtsOpen("world_tree")).toHaveLength(DISTRICTS.length);
  });

  test("every existing place has a home district, and the sandbox stays in the base camp", () => {
    const hosted = new Map<string, string>();
    for (const d of DISTRICTS) for (const p of d.places) hosted.set(p, d.id);
    for (const place of ["me", "quests", "leaderboard", "garden", "discoveries", "store", "skills", "compare", "analytics", "admin", "playground"]) {
      expect(hosted.get(place), place).toBeDefined();
    }
    expect(placeDistrict("playground")).toBe("base_camp");
    expect(placeDistrict("me")).toBe("base_camp");
    expect(placeDistrict("garden")).toBe("terrace");
    expect(placeDistrict("no-such-place")).toBeNull();
  });

  test("stage ids index in order", () => {
    expect(stageIndex("seed")).toBe(0);
    expect(stageIndex("world_tree")).toBe(8);
    const later: StageId = "great";
    expect(stageIndex(later)).toBeGreaterThan(stageIndex("young"));
  });
});

describe("layout", () => {
  const seeds = [1, 42, 7_777, 0xdeadbeef, 123_456_789];

  test("is deterministic for a seed and stage", () => {
    for (const seed of seeds) {
      expect(layout(seed, "elder")).toEqual(layout(seed, "elder"));
    }
  });

  test("puts the tree at the origin and every district's anchor at its own tile, none overlapping", () => {
    for (const seed of seeds) {
      const l = layout(seed, "world_tree");
      expect(l.tree).toEqual(TREE_ORIGIN);
      const anchors = l.districts.map((d) => `${d.at.x},${d.at.y}`);
      expect(new Set(anchors).size).toBe(anchors.length);
      for (const d of l.districts) {
        const dist = Math.hypot(d.at.x, d.at.y);
        expect(dist, `${d.id} for seed ${seed}`).toBeGreaterThanOrEqual(d.id === "base_camp" ? 0 : 5);
        expect(dist).toBeLessThan(60);
      }
    }
  });

  test("districts keep their anchors as the tree grows, so nothing moves under a player", () => {
    for (const seed of seeds) {
      const young = layout(seed, "young");
      const elder = layout(seed, "elder");
      for (const d of young.districts) {
        expect(elder.districts.find((e) => e.id === d.id)?.at).toEqual(d.at);
      }
      expect(young.districts.map((d) => d.id)).toEqual(districtsOpen("young"));
    }
  });

  test("lays out home plots on the homes ring, 24 plus 12 per ring, all distinct", () => {
    const seed = seeds[1];
    expect(layout(seed, "grown", 0).homes).toHaveLength(24);
    const withRings = layout(seed, "world_tree", 3).homes;
    expect(withRings).toHaveLength(60);
    expect(new Set(withRings.map((h) => `${h.x},${h.y}`)).size).toBe(60);
    // Before the homes ring opens there are no plots to see.
    expect(layout(seed, "young").homes).toHaveLength(0);
  });

  test("places ruins in three rings of six, farther as the tier rises, each with a stable name", () => {
    const l = layout(seeds[2], "elder");
    const byTier = (t: 1 | 2 | 3) => l.ruins.filter((r) => r.tier === t);
    expect(byTier(1)).toHaveLength(6);
    expect(byTier(2)).toHaveLength(6);
    expect(byTier(3)).toHaveLength(6);
    const radius = (t: 1 | 2 | 3) => byTier(t).map((r) => Math.hypot(r.at.x, r.at.y));
    expect(Math.min(...radius(2))).toBeGreaterThan(Math.max(...radius(1)));
    expect(Math.min(...radius(3))).toBeGreaterThan(Math.max(...radius(2)));
    expect(new Set(l.ruins.map((r) => r.id)).size).toBe(18);
    expect(new Set(l.ruins.map((r) => r.name)).size).toBe(18);
    expect(l.ruins[0].name).toMatch(/^The \w+ \w+$/);
    // Ruins that aren't open yet aren't in the layout.
    expect(layout(seeds[2], "great").ruins.every((r) => r.tier === 1)).toBe(true);
    expect(layout(seeds[2], "young").ruins).toHaveLength(0);
  });

  test("two seeds give two different trees", () => {
    const a = layout(seeds[0], "elder");
    const b = layout(seeds[1], "elder");
    const same = a.districts.filter((d) => b.districts.find((e) => e.id === d.id && e.at.x === d.at.x && e.at.y === d.at.y));
    expect(same.length).toBeLessThan(a.districts.length / 2);
  });
});
