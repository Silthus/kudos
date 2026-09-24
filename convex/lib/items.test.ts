import { describe, expect, test } from "vitest";
import { GAME_AREAS } from "./xp";
import { ITEMS, itemByKey, quoteItem, SHOP_LEVEL, shopAccess, realRewardsOn, monthOf } from "./items";
import { resetCost } from "./skills";

describe("the shop's door (#55 §G1, G5)", () => {
  const on = { gameEnabled: true };
  test("is locked until level 5, where the Me tile says it opens", () => {
    expect(SHOP_LEVEL).toBe(5);
    expect(GAME_AREAS.find((a) => a.key === "store")?.level).toBe(SHOP_LEVEL);
    expect(shopAccess(on, {}, 1)).toBe("locked");
    expect(shopAccess(on, {}, 4)).toBe("locked");
    expect(shopAccess(on, {}, 5)).toBe("open");
    expect(shopAccess(on, {}, 25)).toBe("open");
  });

  test("is gone while the game is off or the member hides it: Hog coins are the game's currency", () => {
    expect(shopAccess({ gameEnabled: false }, {}, 9)).toBe("off");
    expect(shopAccess({}, {}, 9)).toBe("off");
    expect(shopAccess(on, { gameHidden: true }, 9)).toBe("hidden");
  });

  test("real rewards need their own admin switch, off by default, and the game", () => {
    expect(realRewardsOn({ gameEnabled: true })).toBe(false);
    expect(realRewardsOn({ gameEnabled: true, realRewardsEnabled: true })).toBe(true);
    expect(realRewardsOn({ gameEnabled: false, realRewardsEnabled: true })).toBe(false);
    // The old received-kudos store switch no longer opens anything (ADR 0002: reset, not converted).
    expect(realRewardsOn({ gameEnabled: true, storeEnabled: true } as never)).toBe(false);
  });
});

describe("game items", () => {
  test("have unique keys and a price in whole Hog coins", () => {
    const keys = ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of ITEMS) {
      const { price } = quoteItem(item, { ever: 0, thisMonth: 0 }, {});
      expect(Number.isInteger(price) && price > 0, item.key).toBe(true);
    }
    expect(itemByKey("nope")).toBeUndefined();
  });

  test("start with extra spree joins and a skill-tree reset", () => {
    expect(ITEMS.map((i) => i.key)).toEqual(expect.arrayContaining(["spreeJoin", "skillReset"]));
  });

  test("an extra spree join costs more than a spree can pay back, and at most 5 a month", () => {
    // A join pays its joiner 1 coin, plus 1 per further tier: never more than 5 coins (§G6).
    const join = itemByKey("spreeJoin")!;
    expect(quoteItem(join, { ever: 40, thisMonth: 0 }, {})).toEqual({ price: 8, limitReached: false });
    expect(quoteItem(join, { ever: 40, thisMonth: 4 }, {})).toEqual({ price: 8, limitReached: false });
    expect(quoteItem(join, { ever: 40, thisMonth: 5 }, {})).toEqual({ price: 8, limitReached: true });
  });

  test("a skill-tree reset costs what the skill tree charges: more each time, however it was reset before (§G7)", () => {
    const reset = itemByKey("skillReset")!;
    // Resets on the skill tree page count too, so the price follows the player, not Store purchases.
    const prices = [0, 1, 2, 3, 4].map((skillResets) => quoteItem(reset, { ever: 0, thisMonth: 0 }, { skillResets }).price);
    expect(prices).toEqual([50, 100, 200, 400, 600]);
    expect(prices).toEqual([0, 1, 2, 3, 4].map(resetCost));
  });

  test("months are the workspace's calendar months", () => {
    // 23:30 UTC on 30 Sept is already October in Berlin.
    expect(monthOf(Date.UTC(2026, 8, 30, 23, 30), "Europe/Berlin")).toBe("2026-10");
    expect(monthOf(Date.UTC(2026, 8, 30, 23, 30), "UTC")).toBe("2026-09");
  });
});
