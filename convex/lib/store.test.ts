import { describe, expect, test } from "vitest";
import { concentration, isOpen, transition, validateAdjustment, validateRewardInput } from "./store";

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

describe("transition", () => {
  const admin = { isAdmin: true, isRequester: false };
  const requester = { isAdmin: false, isRequester: true };

  test("admins approve, fulfil or decline a pending request", () => {
    expect(transition("pending", "approve", admin)).toEqual({ to: "approved", refund: false });
    expect(transition("pending", "fulfill", admin)).toEqual({ to: "fulfilled", refund: false });
    expect(transition("pending", "decline", admin)).toEqual({ to: "declined", refund: true });
  });

  test("admins fulfil or decline an approved request, but can't approve it twice", () => {
    expect(transition("approved", "fulfill", admin)).toEqual({ to: "fulfilled", refund: false });
    expect(transition("approved", "decline", admin)).toEqual({ to: "declined", refund: true });
    expect(() => transition("approved", "approve", admin, "Lena")).toThrow("Already approved by Lena.");
  });

  test("the requester cancels only while the request is pending", () => {
    expect(transition("pending", "cancel", requester)).toEqual({ to: "cancelled", refund: true });
    expect(() => transition("approved", "cancel", requester)).toThrow(/already approved, so ask an admin/);
  });

  test("finished requests never move again", () => {
    for (const from of ["fulfilled", "declined", "cancelled"] as const) {
      for (const action of ["approve", "fulfill", "decline"] as const) {
        expect(() => transition(from, action, admin, "Ana")).toThrow(`Already ${from} by Ana.`);
      }
      expect(() => transition(from, "cancel", requester)).toThrow(`Already ${from}.`);
    }
  });

  test("only admins decide and only the requester cancels", () => {
    for (const action of ["approve", "fulfill", "decline"] as const) {
      expect(() => transition("pending", action, requester)).toThrow(/Only workspace admins/);
    }
    expect(() => transition("pending", "cancel", admin)).toThrow(/Only the person who asked/);
    // An admin who asked for a reward can still cancel their own pending request.
    expect(transition("pending", "cancel", { isAdmin: true, isRequester: true })).toEqual({ to: "cancelled", refund: true });
  });
});

describe("isOpen", () => {
  test("pending and approved requests are open, the rest are finished", () => {
    expect((["pending", "approved", "fulfilled", "declined", "cancelled"] as const).map(isOpen)).toEqual([true, true, false, false, false]);
  });
});

describe("validateAdjustment", () => {
  test("accepts whole amounts either way and trims the reason", () => {
    expect(validateAdjustment({ amount: 10, reason: "  Hackathon winner " })).toEqual({ amount: 10, reason: "Hackathon winner" });
    expect(validateAdjustment({ amount: -10_000, reason: "Took back a hoodie" })).toEqual({ amount: -10_000, reason: "Took back a hoodie" });
    expect(validateAdjustment({ amount: 10_000, reason: "abc" }).amount).toBe(10_000);
  });

  test("refuses zero, fractions and amounts beyond 10,000 either way", () => {
    for (const amount of [0, 1.5, 10_001, -10_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateAdjustment({ amount, reason: "Hackathon winner" })).toThrow(/whole number between −10,000 and 10,000, not 0/);
    }
  });

  test("needs a reason of 3–200 characters", () => {
    expect(() => validateAdjustment({ amount: 5, reason: "  ok " })).toThrow(/reason of 3–200 characters/);
    expect(() => validateAdjustment({ amount: 5, reason: "x".repeat(201) })).toThrow(/reason of 3–200 characters/);
    expect(validateAdjustment({ amount: 5, reason: "x".repeat(200) }).reason).toHaveLength(200);
  });

  test("collapses line breaks so a reason stays one line", () => {
    expect(validateAdjustment({ amount: 5, reason: "Hackathon\n\nwinner" }).reason).toBe("Hackathon winner");
  });
});

describe("concentration", () => {
  test("is flagged when one giver brings half or more, and at least 20", () => {
    expect(concentration([{ amount: 20 }, { amount: 20 }])).toBe(true);
    expect(concentration([{ amount: 30 }, { amount: 10 }, { amount: 5 }])).toBe(true);
  });

  test("isn't flagged for a spread-out balance", () => {
    expect(concentration([{ amount: 19 }, { amount: 11 }, { amount: 10 }])).toBe(false);
  });

  test("isn't flagged below 20 kudos, however lopsided", () => {
    expect(concentration([{ amount: 19 }])).toBe(false);
    expect(concentration([])).toBe(false);
  });
});
