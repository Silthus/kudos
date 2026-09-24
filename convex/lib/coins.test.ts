import { describe, expect, test } from "vitest";
import { canSpend, coinBalance, formatCoins, lineCoins, WALLET_LEVEL } from "./coins";
import { GAME_AREAS } from "./xp";

describe("Hog coins (#55 §G4)", () => {
  test("a qualifying kudos earns its giver 1 per kudos given; anything else earns nothing", () => {
    expect(lineCoins({ qualifying: true, amount: 1 })).toBe(1);
    expect(lineCoins({ qualifying: true, amount: 2 })).toBe(2); // two tacos to one person
    expect(lineCoins({ qualifying: false, amount: 3 })).toBe(0); // no reason, or a thank-back
  });

  test("the balance is what kudos earned plus 10 per level reached, minus spending, plus or minus adjustments", () => {
    expect(coinBalance({ coins: 7, level: 1 })).toMatchObject({ balance: 7, fromKudos: 7, fromLevels: 0 });
    expect(coinBalance({ coins: 7, level: 3 })).toMatchObject({ balance: 27, fromKudos: 7, fromLevels: 20 });
    expect(coinBalance({ coins: 7, level: 3 }, { coinsSpent: 30, coinsAdjusted: -2 })).toMatchObject({ balance: -5, spent: 30, adjusted: -2 });
    expect(coinBalance({ level: 1 })).toMatchObject({ balance: 0 }); // a player from before coins
  });

  test("quest coins are their own source in the breakdown, not thoughtful kudos", () => {
    expect(coinBalance({ coins: 12, questCoins: 7, level: 5 })).toEqual({ balance: 52, fromKudos: 5, fromQuests: 7, fromLevels: 40, spent: 0, adjusted: 0 });
    expect(coinBalance({ coins: 3, level: 1 })).toMatchObject({ fromKudos: 3, fromQuests: 0 });
  });

  test("a revoke can take the balance below zero, which blocks spending until it's positive again", () => {
    expect(canSpend(-3, 1)).toBe(false);
    expect(canSpend(0, 1)).toBe(false);
    expect(canSpend(5, 5)).toBe(true);
    expect(canSpend(5, 6)).toBe(false);
  });

  test("the wallet appears at level 3, where its locked tile said it would", () => {
    expect(WALLET_LEVEL).toBe(3);
    expect(GAME_AREAS.find((a) => a.key === "wallet")?.level).toBe(WALLET_LEVEL);
  });

  test("amounts read as Hog coins, singular for one", () => {
    expect([formatCoins(1), formatCoins(12), formatCoins(0), formatCoins(-3), formatCoins(1200)]).toEqual([
      "1 Hog coin",
      "12 Hog coins",
      "0 Hog coins",
      "−3 Hog coins",
      "1,200 Hog coins",
    ]);
  });
});
