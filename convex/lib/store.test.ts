import { describe, expect, test } from "vitest";
import { balanceOf, validateRewardInput } from "./store";

describe("balanceOf", () => {
  test("is everything received when nothing was granted or spent yet", () => {
    expect(balanceOf({ totalReceived: 42 })).toBe(42);
  });

  test("adds grants and subtracts spending", () => {
    expect(balanceOf({ totalReceived: 42, storeGranted: 10, storeSpent: 15 })).toBe(37);
  });

  test("goes negative when spent kudos were revoked afterwards", () => {
    expect(balanceOf({ totalReceived: 12, storeSpent: 15 })).toBe(-3);
  });
});

describe("validateRewardInput", () => {
  const valid = { name: "Coffee on us", emoji: "☕", cost: 15 };

  test("trims text and drops empty optional fields", () => {
    expect(
      validateRewardInput({ name: "  Coffee on us ", emoji: " ☕ ", cost: 15, description: "   ", prompt: " ", stock: undefined }),
    ).toEqual({ name: "Coffee on us", emoji: "☕", cost: 15, description: undefined, prompt: undefined, stock: undefined, maxPerMember: undefined });
    expect(validateRewardInput({ ...valid, description: " A flat white. ", prompt: " Oat or dairy? " })).toMatchObject({
      description: "A flat white.",
      prompt: "Oat or dairy?",
    });
  });

  test("keeps stock and per-person limits", () => {
    expect(validateRewardInput({ ...valid, stock: 0, maxPerMember: 1 })).toMatchObject({ stock: 0, maxPerMember: 1 });
    expect(validateRewardInput({ ...valid, stock: 10_000, maxPerMember: 100 })).toMatchObject({ stock: 10_000, maxPerMember: 100 });
  });

  test("keeps names on one line and refuses invisible-only names", () => {
    expect(validateRewardInput({ ...valid, name: "Coffee\n on   us" }).name).toBe("Coffee on us");
    expect(() => validateRewardInput({ ...valid, name: "​​" })).toThrow(/name/);
    expect(() => validateRewardInput({ ...valid, emoji: "️" })).toThrow(/emoji/);
  });

  test("needs a name of 1–60 characters", () => {
    expect(() => validateRewardInput({ ...valid, name: "  " })).toThrow(/name/);
    expect(validateRewardInput({ ...valid, name: "x".repeat(60) }).name).toHaveLength(60);
    expect(() => validateRewardInput({ ...valid, name: "x".repeat(61) })).toThrow(/name/);
  });

  test("needs an emoji of 1–16 characters", () => {
    expect(() => validateRewardInput({ ...valid, emoji: " " })).toThrow(/emoji/);
    expect(validateRewardInput({ ...valid, emoji: "x".repeat(16) }).emoji).toHaveLength(16);
    expect(() => validateRewardInput({ ...valid, emoji: "x".repeat(17) })).toThrow(/emoji/);
  });

  test("caps the description at 280 and the question at 120 characters", () => {
    expect(validateRewardInput({ ...valid, description: "x".repeat(280) }).description).toHaveLength(280);
    expect(() => validateRewardInput({ ...valid, description: "x".repeat(281) })).toThrow(/description/);
    expect(validateRewardInput({ ...valid, prompt: "x".repeat(120) }).prompt).toHaveLength(120);
    expect(() => validateRewardInput({ ...valid, prompt: "x".repeat(121) })).toThrow(/question/);
  });

  test("prices rewards in whole kudos between 1 and 100 000", () => {
    expect(validateRewardInput({ ...valid, cost: 1 }).cost).toBe(1);
    expect(validateRewardInput({ ...valid, cost: 100_000 }).cost).toBe(100_000);
    for (const cost of [0, -5, 100_001, 2.5, Number.NaN]) {
      expect(() => validateRewardInput({ ...valid, cost })).toThrow(/Cost/);
    }
  });

  test("tracks stock between 0 and 10 000 whole items", () => {
    for (const stock of [-1, 10_001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateRewardInput({ ...valid, stock })).toThrow(/Stock/);
    }
  });

  test("limits per person between 1 and 100", () => {
    for (const maxPerMember of [0, 101, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateRewardInput({ ...valid, maxPerMember })).toThrow(/per-person/);
    }
  });
});
