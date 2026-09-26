import { describe, expect, test } from "vitest";
import { HOME_STAGES, nextHomeStage, PLOT_PRICE, stageCost } from "./homes";

/** Homes on the tree (#152 S5): a plot, then six stages paid in coins and days. */

describe("homes", () => {
  test("a plot costs 40 and the stages follow the spec's costs and days", () => {
    expect(PLOT_PRICE).toBe(40);
    expect(HOME_STAGES.map((s) => [s.id, s.cost, s.days])).toEqual([
      ["sky", 0, 0],
      ["planks", 30, 2],
      ["leaf_hut", 60, 5],
      ["timber_house", 120, 10],
      ["lantern_lodge", 250, 20],
      ["canopy_manor", 500, 40],
    ]);
    expect(nextHomeStage("sky")?.id).toBe("planks");
    expect(nextHomeStage("canopy_manor")).toBeNull();
  });

  test("a star fruit takes a quarter off, rounded up, and a bad discount is ignored", () => {
    expect(stageCost(HOME_STAGES[1], 25)).toBe(23);
    expect(stageCost(HOME_STAGES[1])).toBe(30);
    expect(stageCost(HOME_STAGES[1], NaN)).toBe(30);
    expect(stageCost(HOME_STAGES[1], 500)).toBe(0);
  });
});
