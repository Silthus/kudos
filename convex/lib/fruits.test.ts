import { describe, expect, test } from "vitest";
import { mulberry32 } from "./random";
import { FRUITS, FRUIT_PER_COINS, fruitEffect, fruitsBetween, isFruitId, rollFruits, type FruitId } from "./fruits";

/** Tree fruit (#152 S3): rolled when appreciation is claimed at the tree, spent at the stall or where it applies. */

describe("the fruit catalogue", () => {
  test("has the five kinds, rarest last, with weights that favour the common one", () => {
    expect(FRUITS.map((f) => f.id)).toEqual(["sun", "moon", "amber", "star", "heart"]);
    expect(FRUITS.map((f) => f.weight)).toEqual([60, 25, 10, 4, 1]);
    expect(FRUITS.every((f) => f.name && f.about)).toBe(true);
    expect(isFruitId("moon")).toBe(true);
    expect(isFruitId("constructor")).toBe(false);
  });

  test("each kind has one effect the rest of the game can apply", () => {
    expect(fruitEffect("sun")).toEqual({ kind: "sell", coins: 3 });
    expect(fruitEffect("moon")).toEqual({ kind: "stamina", amount: 1 });
    expect(fruitEffect("amber")).toEqual({ kind: "luckyCharm", charges: 1 });
    expect(fruitEffect("star")).toEqual({ kind: "homeDiscount", percent: 25 });
    expect(fruitEffect("heart")).toEqual({ kind: "superSeed", plantStage: "sapling" });
  });
});

describe("rolling fruit on a claim", () => {
  test("gives one fruit per five coins of lifetime claims, so small claims add up", () => {
    expect(FRUIT_PER_COINS).toBe(5);
    expect(fruitsBetween(0, 4)).toBe(0);
    expect(fruitsBetween(4, 8)).toBe(1);
    expect(fruitsBetween(8, 12)).toBe(1);
    expect(fruitsBetween(0, 23)).toBe(4);
    expect(fruitsBetween(23, 23)).toBe(0);
    expect(fruitsBetween(10, 5)).toBe(0);
  });

  test("shrugs off bad numbers", () => {
    expect(fruitsBetween(NaN, Infinity)).toBe(0);
    expect(rollFruits(Infinity, mulberry32(1))).toEqual([]);
    expect(rollFruits(-2, mulberry32(1))).toEqual([]);
    expect(rollFruits(2.9, mulberry32(1))).toHaveLength(2);
  });

  test("is deterministic for a seed", () => {
    expect(rollFruits(10, mulberry32(9))).toEqual(rollFruits(10, mulberry32(9)));
  });

  test("lands on the catalogue's weights over many rolls", () => {
    const counts: Record<FruitId, number> = { sun: 0, moon: 0, amber: 0, star: 0, heart: 0 };
    for (const id of rollFruits(20_000, mulberry32(2026))) counts[id]++;
    const share = (id: FruitId) => counts[id] / 20_000;
    expect(share("sun")).toBeGreaterThan(0.56);
    expect(share("sun")).toBeLessThan(0.64);
    expect(share("heart")).toBeGreaterThan(0.005);
    expect(share("heart")).toBeLessThan(0.016);
  });
});
