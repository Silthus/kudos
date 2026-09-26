import { describe, expect, test } from "vitest";
import {
  DISTRICT_BY_ID,
  DISTRICTS,
  districtsOpen,
  fuelForLine,
  growthFor,
  growthToNext,
  growthToReach,
  homePlots,
  isRaidId,
  isTreeStageId,
  layout,
  MAX_ANCHOR_RADIUS,
  MAX_HOME_PLOTS,
  MIN_ANCHOR_GAP,
  OFFERING_AUTO_CLAIM_DAYS,
  placeDistrict,
  raidTier,
  ringsForGrowth,
  ruinTier,
  SEED_AUTO_PLANT_DAYS,
  seedsForLine,
  stageForGrowth,
  stageIndex,
  TREE_ORIGIN,
  TREE_STAGES,
  type Tile,
  type TreeStageId,
} from "./tree";

/** The Ancient Tree's pure rules (#152 S1): stages by growth, districts by stage, a seeded, stable layout. */

const AT: Record<TreeStageId, number> = { seed: 0, sprout: 5, sapling: 25, young: 100, grown: 300, great: 800, ancient: 2000, elder: 3000, world_tree: 8000 };
const gap = (a: Tile, b: Tile) => Math.hypot(a.x - b.x, a.y - b.y);
const seeds = Array.from({ length: 300 }, (_, i) => (i * 2_654_435_761 + 12_345) >>> 0);

describe("stages by growth", () => {
  test("follow the spec's thresholds and are monotonic", () => {
    expect(TREE_STAGES.map((s) => s.id)).toEqual(["seed", "sprout", "sapling", "young", "grown", "great", "ancient", "elder", "world_tree"]);
    expect(TREE_STAGES.map((s) => s.growth)).toEqual([0, 5, 25, 100, 300, 800, 2000, 3000, 8000]);
    for (let i = 1; i < TREE_STAGES.length; i++) expect(TREE_STAGES[i].growth).toBeGreaterThan(TREE_STAGES[i - 1].growth);
    expect(isTreeStageId("elder")).toBe(true);
    expect(isTreeStageId("constructor")).toBe(false);
  });

  test("a stage is reached exactly at its threshold", () => {
    expect(stageForGrowth(0)).toBe("seed");
    expect(stageForGrowth(4)).toBe("seed");
    expect(stageForGrowth(5)).toBe("sprout");
    expect(stageForGrowth(2000)).toBe("ancient");
    expect(stageForGrowth(7999)).toBe("elder");
    expect(stageForGrowth(8000)).toBe("world_tree");
    expect(stageForGrowth(1_000_000)).toBe("world_tree");
  });

  test("growth to the next stage counts down, then to the next ring forever; growth to reach a stage is for the promises", () => {
    expect(growthToNext(0)).toEqual({ next: "sprout", growth: 5 });
    expect(growthToNext(60)).toEqual({ next: "young", growth: 40 });
    expect(growthToNext(8000)).toEqual({ next: "ring", growth: 10_000 });
    expect(growthToNext(17_999)).toEqual({ next: "ring", growth: 1 });
    expect(growthToReach(38, "young")).toBe(62);
    expect(growthToReach(500, "young")).toBe(0);
  });

  test("rings grow forever past the world tree, one per 10,000", () => {
    expect([0, 7999, 8000, 18_000, 48_000].map(ringsForGrowth)).toEqual([0, 0, 0, 1, 4]);
  });

  test("growth is planted seeds plus half a point per fuel claimed; fuel is one per qualifying line, never the coin amount", () => {
    expect(growthFor({ sap: 10, fuel: 0 })).toBe(10);
    expect(growthFor({ sap: 10, fuel: 7 })).toBe(13);
    expect(growthFor({ sap: 10, fuel: -4 })).toBe(10);
    expect(growthFor({ sap: -50, fuel: 10 })).toBe(5);
    expect(growthFor({ sap: NaN, fuel: NaN })).toBe(0);
    expect(fuelForLine({ qualifying: true })).toBe(1);
    expect(fuelForLine({ qualifying: false })).toBe(0);
    expect(OFFERING_AUTO_CLAIM_DAYS).toBe(30);
  });

  test("bad numbers never break it: negative growth is the seed, fractions and NaN are truncated", () => {
    expect(stageForGrowth(-3)).toBe("seed");
    expect(growthToNext(-3)).toEqual({ next: "sprout", growth: 8 });
    expect(stageForGrowth(NaN)).toBe("seed");
    expect(stageForGrowth(Infinity)).toBe("seed");
    expect(stageForGrowth(24.9)).toBe("sprout");
    expect(ringsForGrowth(NaN)).toBe(0);
  });
});

describe("seeds from kudos", () => {
  test("one seed per qualifying line and never anything else; unplanted seeds plant themselves after 30 days", () => {
    expect(seedsForLine({ qualifying: true })).toBe(1);
    expect(seedsForLine({ qualifying: false })).toBe(0);
    expect(SEED_AUTO_PLANT_DAYS).toBe(30);
  });
});

describe("districts", () => {
  test("open cumulatively by stage, in the spec's order", () => {
    expect(districtsOpen("seed")).toEqual(["base_camp"]);
    expect(districtsOpen("sprout")).toEqual(["base_camp", "signpost", "notice_board"]);
    expect(districtsOpen("sapling")).toEqual(expect.arrayContaining(["terrace", "gallery"]));
    expect(districtsOpen("young")).toEqual(expect.arrayContaining(["stall", "oak", "pool"]));
    expect(districtsOpen("grown")).toEqual(expect.arrayContaining(["homes", "observatory", "gatehouse"]));
    expect(districtsOpen("great")).toEqual(expect.arrayContaining(["near_ruins", "crew"]));
    expect(districtsOpen("ancient")).toEqual(expect.arrayContaining(["far_ruins", "blight"]));
    expect(districtsOpen("elder")).toEqual(expect.arrayContaining(["deep_ruins", "overview"]));
    expect(districtsOpen("world_tree")).toContain("canopy");
    expect(districtsOpen("world_tree")).toHaveLength(DISTRICTS.length);
    expect(DISTRICT_BY_ID.stall.opens).toBe("young");
  });

  test("every existing place has a home district, and the sandbox stays in the base camp", () => {
    for (const place of ["me", "offering", "quests", "leaderboard", "garden", "discoveries", "store", "skills", "compare", "analytics", "admin", "playground"]) {
      expect(placeDistrict(place), place).not.toBeNull();
    }
    expect(placeDistrict("playground")).toBe("base_camp");
    expect(placeDistrict("garden")).toBe("terrace");
    expect(placeDistrict("no-such-place")).toBeNull();
  });

  test("stage ids index in order", () => {
    expect(stageIndex("seed")).toBe(0);
    expect(stageIndex("world_tree")).toBe(8);
  });

  test("ruin ids carry their tier and index; the blight raid is a ruin of its stage's tier", () => {
    expect(ruinTier("ruin:2:4")).toBe(2);
    expect(ruinTier("ruin:2:6")).toBeNull();
    expect(ruinTier("ruin:1:007")).toBeNull();
    expect(ruinTier("ruin:9:0")).toBeNull();
    expect(ruinTier("raid:3")).toBe(3);
    expect(isRaidId("raid:1")).toBe(true);
    expect(isRaidId("ruin:1:0")).toBe(false);
    expect([raidTier("ancient"), raidTier("elder"), raidTier("world_tree")]).toEqual([1, 2, 3]);
  });
});

describe("layout", () => {
  test("is deterministic for a seed and growth", () => {
    for (const seed of seeds.slice(0, 20)) expect(layout(seed, AT.elder)).toEqual(layout(seed, AT.elder));
  });

  test("pins a known tree at the top stage, so a change to the layout rules is a deliberate one", () => {
    const l = layout(42, AT.world_tree);
    expect(l.stage).toBe("world_tree");
    expect(l.tree).toEqual(TREE_ORIGIN);
    expect(l.districts.map((d) => `${d.id}@${d.at.x},${d.at.y}${d.open ? "" : " (closed)"}`)).toMatchSnapshot();
    expect(l.homes.slice(0, 6)).toMatchSnapshot();
    expect(l.ruins.map((r) => `${r.id} ${r.name} @${r.at.x},${r.at.y}`)).toMatchSnapshot();
  });

  test("returns every district with whether it's open, so closed ones can be drawn as outlines", () => {
    const l = layout(seeds[3], AT.young);
    expect(l.districts).toHaveLength(DISTRICTS.length);
    expect(l.districts.filter((d) => d.open).map((d) => d.id)).toEqual(districtsOpen("young"));
    expect(l.districts.find((d) => d.id === "homes")?.open).toBe(false);
  });

  test("keeps every anchor within reach, at least the minimum gap from every other, and homes off every anchor", () => {
    for (const seed of seeds) {
      const l = layout(seed, AT.world_tree + 3 * 10_000);
      for (const d of l.districts) expect(Math.hypot(d.at.x, d.at.y)).toBeLessThanOrEqual(MAX_ANCHOR_RADIUS + 0.75);
      for (let i = 0; i < l.districts.length; i++)
        for (let j = i + 1; j < l.districts.length; j++)
          expect(gap(l.districts[i].at, l.districts[j].at), `${l.districts[i].id}/${l.districts[j].id} seed ${seed}`).toBeGreaterThanOrEqual(MIN_ANCHOR_GAP);
      for (const h of l.homes) for (const d of l.districts) expect(gap(h, d.at), `home ${h.x},${h.y} on ${d.id} seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  test("districts, ruins and plots keep their anchors as the tree grows, so nothing moves under a player", () => {
    for (const seed of seeds.slice(0, 40)) {
      const young = layout(seed, AT.young);
      const elder = layout(seed, AT.elder);
      const top = layout(seed, AT.world_tree + 50_000);
      for (const d of young.districts) {
        expect(elder.districts.find((e) => e.id === d.id)?.at).toEqual(d.at);
        expect(top.districts.find((e) => e.id === d.id)?.at).toEqual(d.at);
      }
      const great = layout(seed, AT.great);
      for (const r of great.ruins) expect(elder.ruins.find((e) => e.id === r.id)).toEqual(r);
      elder.homes.forEach((h, i) => expect(top.homes[i]).toEqual(h));
    }
  });

  test("lays out home plots 24 plus 12 per ring up to the cap, all distinct and apart, none before the homes district opens", () => {
    expect(layout(seeds[1], AT.young).homes).toHaveLength(0);
    expect(homePlots(AT.young)).toBe(0);
    expect(layout(seeds[1], AT.grown).homes).toHaveLength(24);
    expect(homePlots(AT.grown)).toBe(24);
    const many = layout(seeds[1], AT.world_tree + 48 * 10_000).homes;
    expect(many).toHaveLength(MAX_HOME_PLOTS);
    expect(homePlots(AT.world_tree + 99 * 10_000)).toBe(MAX_HOME_PLOTS);
    expect(new Set(many.map((h) => `${h.x},${h.y}`)).size).toBe(many.length);
    for (let i = 0; i < many.length; i++) for (let j = i + 1; j < many.length; j++) expect(gap(many[i], many[j])).toBeGreaterThanOrEqual(1.5);
    for (const h of many) expect(Math.hypot(h.x, h.y)).toBeLessThan(55);
  });

  test("places ruins in three rings of six, farther as the tier rises, each with a stable name", () => {
    const l = layout(seeds[2], AT.elder);
    const byTier = (t: 1 | 2 | 3) => l.ruins.filter((r) => r.tier === t);
    for (const t of [1, 2, 3] as const) expect(byTier(t)).toHaveLength(6);
    const radius = (t: 1 | 2 | 3) => byTier(t).map((r) => Math.hypot(r.at.x, r.at.y));
    expect(Math.min(...radius(1))).toBeGreaterThan(55);
    expect(Math.min(...radius(2))).toBeGreaterThan(Math.max(...radius(1)));
    expect(Math.min(...radius(3))).toBeGreaterThan(Math.max(...radius(2)));
    expect(new Set(l.ruins.map((r) => r.id)).size).toBe(18);
    expect(l.ruins[0].name).toMatch(/^The \w+ \w+$/);
    expect(layout(seeds[2], AT.great).ruins.every((r) => r.tier === 1)).toBe(true);
    expect(layout(seeds[2], AT.young).ruins).toHaveLength(0);
  });

  test("two seeds give two different trees", () => {
    const a = layout(seeds[0], AT.elder);
    const b = layout(seeds[1], AT.elder);
    const same = a.districts.filter((d) => b.districts.find((e) => e.id === d.id && e.at.x === d.at.x && e.at.y === d.at.y));
    expect(same.length).toBeLessThan(a.districts.length / 2);
  });
});
