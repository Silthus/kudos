import { describe, expect, test } from "vitest";
import { DUSK, GOLDEN } from "./Sky";

const red = (hex: string) => parseInt(hex.slice(1, 3), 16);

describe("the sky's bands", () => {
  test("dusk is the world's own dusk, one colour", () => {
    expect(DUSK).toEqual([{ color: "#241e33", height: 100 }]);
  });

  test("golden hour fills the screen and warms band by band down to the horizon", () => {
    expect(GOLDEN.reduce((sum, b) => sum + b.height, 0)).toBe(100);
    const sky = GOLDEN.slice(0, -1);
    for (let i = 1; i < sky.length; i++) expect(red(sky[i].color)).toBeGreaterThan(red(sky[i - 1].color));
    // Below the horizon the ground is dusk again, warmed a little.
    expect(red(GOLDEN.at(-1)!.color)).toBeLessThan(red(sky.at(-1)!.color));
  });
});
