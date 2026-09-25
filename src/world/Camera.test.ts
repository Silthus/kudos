import { describe, expect, test } from "vitest";
import { centreOn, clampCamera, follow, worldScale } from "./Camera";

describe("the world's scale", () => {
  test("is a whole number: 2× on a phone, 3× on anything wider", () => {
    expect(worldScale(320)).toBe(2);
    expect(worldScale(390)).toBe(2);
    expect(worldScale(639)).toBe(2);
    expect(worldScale(640)).toBe(3);
    expect(worldScale(1280)).toBe(3);
  });
});

describe("the camera", () => {
  const view = { width: 1000, height: 600 };
  const stage = { width: 3000, height: 2000 };

  test("centres on a point", () => {
    expect(centreOn({ x: 1500, y: 1000 }, view)).toEqual({ x: 1000, y: 700 });
  });

  test("holds still while the hedgehog walks inside the middle of the view", () => {
    const cam = { x: 1000, y: 700 };
    expect(follow(cam, { x: 1550, y: 1040 }, view)).toEqual(cam);
  });

  test("moves just enough to keep the hedgehog inside the middle of the view", () => {
    const cam = { x: 1000, y: 700 };
    // The middle is the central 40 %: x 300–700 and y 180–420 of the view.
    expect(follow(cam, { x: 1800, y: 1000 }, view)).toEqual({ x: 1100, y: 700 });
    expect(follow(cam, { x: 1500, y: 800 }, view)).toEqual({ x: 1000, y: 620 });
  });

  test("never shows more than a little sky past the world's edge", () => {
    expect(clampCamera({ x: -500, y: -500 }, view, stage)).toEqual({ x: -48, y: -48 });
    expect(clampCamera({ x: 5000, y: 5000 }, view, stage)).toEqual({ x: 2048, y: 1448 });
  });

  test("a world smaller than the view sits in its middle", () => {
    expect(clampCamera({ x: 0, y: 0 }, { width: 4000, height: 3000 }, stage)).toEqual({ x: -500, y: -500 });
  });
});
