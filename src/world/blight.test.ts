import { describe, expect, test } from "vitest";
import { blightMood, blightTag, blightToasts, daysLeftText } from "./blight";

/** The blight in the world (#164): the sky, the tree's patches and lanterns, the HUD's tag and the toasts. */

const DAY = 86_400_000;
const now = 1_800_000_000_000;
const active = { status: "active" as const, arrivesAt: now - DAY, endsAt: now + 3 * DAY - 60_000, hp: 120, damage: 42, mine: 12, contributors: 5 };

describe("the world's mood", () => {
  test("a blight at the tree tinges the sky and spots the canopy", () => {
    expect(blightMood({ blight: active, lanternsDimUntil: null }, now)).toEqual({ sky: true, blighted: true, dim: false });
  });

  test("an announced blight, a beaten one or none leaves the world as it is", () => {
    expect(blightMood({ blight: { ...active, status: "announced" }, lanternsDimUntil: null }, now)).toEqual({ sky: false, blighted: false, dim: false });
    expect(blightMood({ blight: { ...active, status: "won" }, lanternsDimUntil: null }, now)).toEqual({ sky: false, blighted: false, dim: false });
    expect(blightMood(null, now)).toEqual({ sky: false, blighted: false, dim: false });
    expect(blightMood(undefined, now)).toEqual({ sky: false, blighted: false, dim: false });
  });

  test("a lost blight dims the lanterns until their week is over", () => {
    expect(blightMood({ blight: { ...active, status: "lost" }, lanternsDimUntil: now + DAY }, now)).toMatchObject({ dim: true, sky: false });
    expect(blightMood({ blight: { ...active, status: "lost" }, lanternsDimUntil: now - 1 }, now)).toMatchObject({ dim: false });
  });

  test("a blight whose days ran out (before the server said so) no longer tinges the sky", () => {
    expect(blightMood({ blight: { ...active, endsAt: now - 1 }, lanternsDimUntil: null }, now)).toMatchObject({ sky: false, blighted: false });
  });
});

describe("days left", () => {
  test("say how many days are left, the last one as its own words", () => {
    expect(daysLeftText(now + 3 * DAY - 60_000, now)).toBe("3 days left");
    expect(daysLeftText(now + DAY + 1, now)).toBe("2 days left");
    expect(daysLeftText(now + DAY, now)).toBe("Its last day");
    expect(daysLeftText(now + 60_000, now)).toBe("Its last day");
  });
});

describe("the HUD's tag", () => {
  test("while a blight is at the tree: how much of it is left and the days", () => {
    expect(blightTag({ blight: active, lanternsDimUntil: null }, now)).toEqual({ text: "Blight: 78 of 120 left, 3 days left", left: 78, hp: 120 });
  });

  test("an announced blight says when it comes; otherwise nothing", () => {
    expect(blightTag({ blight: { ...active, status: "announced", arrivesAt: now + DAY + 60_000 }, lanternsDimUntil: null }, now)).toEqual({
      text: "A blight comes in 2 days",
      left: null,
      hp: null,
    });
    expect(blightTag({ blight: { ...active, status: "won" }, lanternsDimUntil: null }, now)).toBeNull();
    expect(blightTag(null, now)).toBeNull();
  });
});

describe("toasts", () => {
  const events = (...kinds: string[]) => kinds.map((kind, i) => ({ _id: `e${i}`, kind }));

  test("a blight announced, arriving, beaten or lost while you're here is a toast; one called off isn't", () => {
    // The log comes newest first.
    const before = events("stage");
    const after = [...events("blight_called_off", "blight_lost", "blight_won", "blight_arrived", "blight_announced").map((e) => ({ ...e, _id: `n${e._id}` })), ...before];
    expect(blightToasts(before, after).map((t) => t.title)).toEqual([
      "A blight is coming",
      "A blight has come to the tree",
      "The blight is beaten",
      "The blight outlasted us",
    ]);
  });

  test("arriving (no earlier look) is no moment", () => {
    expect(blightToasts(undefined, events("blight_arrived"))).toEqual([]);
  });
});
