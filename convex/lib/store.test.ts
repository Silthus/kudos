import { describe, expect, test } from "vitest";
import { balanceOf, isOpen, transition, validateRewardInput } from "./store";

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
