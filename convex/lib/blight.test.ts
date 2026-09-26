import { describe, expect, test } from "vitest";
import { BLIGHT, blightDamage, blightHp, nextBlightAt } from "./blight";

/** Blights (#152 S8): a shared foe the company wears down together. */

describe("blights", () => {
  test("scale with the active company, have a floor, shrink after a defeat, and shrug off bad numbers", () => {
    expect(blightHp(10)).toBe(400);
    expect(blightHp(0)).toBe(BLIGHT.minHp);
    expect(blightHp(10, true)).toBe(200);
    expect(blightHp(1, true)).toBe(BLIGHT.minHp);
    expect(blightHp(NaN)).toBe(BLIGHT.minHp);
    expect(BLIGHT.windowDays).toBe(5);
    expect(BLIGHT.everyDays).toEqual([14, 28]);
    expect(BLIGHT.rewardCoins).toBe(20);
    expect(BLIGHT.activeDays).toBe(30);
    const day = 86_400_000;
    const at = nextBlightAt(7, 1_000 * day, 0);
    expect(at).toBe(nextBlightAt(7, 1_000 * day, 0));
    expect(at - 1_000 * day).toBeGreaterThanOrEqual(14 * day);
    expect(at - 1_000 * day).toBeLessThanOrEqual(28 * day);
    expect(nextBlightAt(7, 1_000 * day, 1)).not.toBe(at);
  });

  test("damage comes from qualifying kudos and from rooms the party actually cleared with effort", () => {
    expect(blightDamage({ source: "kudos" })).toBe(1);
    expect(blightDamage({ source: "room", room: { kind: "foe", foe: "sand_scarab" }, done: "cleared" })).toBe(2);
    expect(blightDamage({ source: "raid_room", room: { kind: "puzzle", puzzle: "who_thanked", difficulty: 4 }, done: "cleared" })).toBe(10);
    expect(blightDamage({ source: "room", room: { kind: "rest" }, done: "cleared" })).toBe(0);
    expect(blightDamage({ source: "raid_room", room: { kind: "secret", lore: 2 }, done: "cleared" })).toBe(0);
    expect(blightDamage({ source: "room", room: { kind: "foe", foe: "sand_scarab" }, done: "fallen" })).toBe(0);
    expect(blightDamage({ source: "room", room: { kind: "foe", foe: "sand_scarab" }, done: "retreated" })).toBe(0);
    expect(blightDamage({ source: "room", room: { kind: "foe", foe: "sand_scarab" }, done: null })).toBe(0);
  });
});
