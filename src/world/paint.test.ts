import { describe, expect, test } from "vitest";
import { layout } from "../../convex/lib/tree";
import { elderOf, paintStanding, standingRect } from "./paint";
import { buildWorld } from "./world";

/** What stands in the world, painted (#156): here, what the elder hog's chain changes in it (#159). */

const world = (standing: string[]) => buildWorld({ seed: 7, layout: layout(7, 0), planted: false, standing });

function painted(standing: string[], dimmed: string[] = []) {
  const w = world(standing);
  const furniture = { beds: [], plots: [], dimmed };
  const at = standingRect(w, furniture);
  const img = { width: at.width, height: at.height, data: new Uint8ClampedArray(at.width * at.height * 4) };
  paintStanding(img, at, w, furniture);
  return img.data;
}

const brightness = (data: Uint8ClampedArray) => {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3]) sum += data[i] + data[i + 1] + data[i + 2];
  return sum;
};

describe("places the chain hasn't reached draw dim", () => {
  test("the same pixels, darker toward the dusk", () => {
    const lit = painted(["offering"]);
    const dim = painted(["offering"], ["offering"]);
    const opaque = (d: Uint8ClampedArray) => [...d].filter((_, i) => i % 4 === 3 && d[i] > 0).length;
    expect(opaque(dim)).toBe(opaque(lit));
    expect(brightness(dim)).toBeLessThan(brightness(lit));
    // Only the stone: the tents round it stay as they are.
    expect(brightness(painted([], []))).toBeLessThan(brightness(dim));
  });
});

describe("the elder hog", () => {
  test("sits on its mat in base camp, a place of its own", () => {
    expect(elderOf(world(["elder"]))).toEqual({ x: 6, y: 2 });
    expect(elderOf(world([]))).toBeNull();
  });
});
