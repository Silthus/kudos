import { describe, expect, test } from "vitest";
import { HEDGEHOG_MODE } from "@/lib/art";
import { FPS, frameAt, frameRect, parseAtlas } from "./atlas";

/** A fake of the Hedgehog Mode atlas: TexturePacker JSON, 80 × 80 frames, animations by name. */
const tiles = (name: string, n: number) => Array.from({ length: n }, (_, i) => `skins/default/${name}/tile${String(i).padStart(3, "0")}.png`);
const fake = {
  frames: Object.fromEntries(
    [...tiles("idle", 3), ...tiles("walk", 4), ...tiles("wave", 2), "accessories/party.png"].map((name, i) => [
      name,
      { frame: { x: (i % 5) * 80, y: Math.floor(i / 5) * 80, w: 80, h: 80 }, rotated: false, trimmed: false },
    ]),
  ),
  animations: { "skins/default/idle/tile": tiles("idle", 3), "skins/default/walk/tile": tiles("walk", 4), "skins/default/wave/tile": tiles("wave", 2) },
  meta: { image: "sprites.png", size: { w: 400, h: 160 } },
};

describe("the Hedgehog Mode atlas", () => {
  test("loads from the pinned package on jsDelivr, registered with the other PostHog art", () => {
    expect(HEDGEHOG_MODE.json).toBe("https://cdn.jsdelivr.net/npm/@posthog/hedgehog-mode@0.0.58/assets/sprites.json");
    expect(HEDGEHOG_MODE.png).toEqual({ src: "https://cdn.jsdelivr.net/npm/@posthog/hedgehog-mode@0.0.58/assets/sprites.png", width: 2000, height: 1440 });
  });

  test("finds an animation's frames in order by its name", () => {
    const atlas = parseAtlas(fake);
    expect(atlas.animations.walk).toEqual([
      { x: 240, y: 0, w: 80, h: 80 },
      { x: 320, y: 0, w: 80, h: 80 },
      { x: 0, y: 80, w: 80, h: 80 },
      { x: 80, y: 80, w: 80, h: 80 },
    ]);
    expect(atlas.animations.idle).toHaveLength(3);
    expect(frameRect(atlas, "accessories/party.png")).toEqual({ x: 320, y: 80, w: 80, h: 80 });
  });

  test("a missing animation or frame is empty, not an error", () => {
    const atlas = parseAtlas(fake);
    expect(atlas.animations.jump).toEqual([]);
    expect(frameRect(atlas, "accessories/nope.png")).toBeNull();
  });

  test("rejects something that isn't an atlas", () => {
    expect(() => parseAtlas({ hello: "world" })).toThrow();
  });
});

describe("stepping through an animation", () => {
  test("walks at about 12 frames a second and idles at about 8", () => {
    expect(FPS.walk).toBe(12);
    expect(FPS.idle).toBe(8);
  });

  test("loops: the frame follows the clock and wraps", () => {
    expect(frameAt(4, 0, 12, true)).toBe(0);
    expect(frameAt(4, 1000 / 12 + 1, 12, true)).toBe(1);
    expect(frameAt(4, (1000 / 12) * 5 + 1, 12, true)).toBe(1);
  });

  test("plays once: a wave ends on its last frame", () => {
    expect(frameAt(26, 10_000, 12, false)).toBe(25);
    expect(frameAt(26, 0, 12, false)).toBe(0);
  });

  test("an empty animation has no frame", () => {
    expect(frameAt(0, 500, 12, true)).toBe(-1);
  });
});
