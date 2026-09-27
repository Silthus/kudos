import { describe, expect, test } from "vitest";
import { BLIGHTED, DUSK, GOLDEN, HAZE, skyBands } from "./Sky";

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

describe("the blight's sky (#164)", () => {
  test("fills the screen, with a band of blight purple-grey over the horizon, and wins over golden hour", () => {
    expect(BLIGHTED.reduce((sum, b) => sum + b.height, 0)).toBe(100);
    expect(BLIGHTED.some((b) => b.color === "#5a4163")).toBe(true);
    expect(skyBands("blight")).toBe(BLIGHTED);
    expect(skyBands("golden")).toBe(GOLDEN);
    expect(skyBands("dusk")).toBe(DUSK);
  });

  test("its haze reaches over the top of the world in hard see-through bands, fading downwards", () => {
    const alpha = (c: string) => Number(/, ([\d.]+)\)$/.exec(c)![1]);
    for (let i = 1; i < HAZE.length; i++) expect(alpha(HAZE[i].color)).toBeLessThan(alpha(HAZE[i - 1].color));
    expect(HAZE.reduce((s, b) => s + b.height, 0)).toBeLessThanOrEqual(25);
  });
});
