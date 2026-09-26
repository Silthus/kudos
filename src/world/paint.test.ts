import { describe, expect, test } from "vitest";
import { layout } from "../../convex/lib/tree";
import { elderOf, hogsOf, paintStanding, signPoints, standingRect } from "./paint";
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

describe("a dim place's sign carries its hint", () => {
  test("so the stone's and the cabin's keep clear of each other with their hint lines, at 2x", () => {
    const w = world(["offering", "me", "elder", "playground"]);
    const hints: Record<string, string> = { offering: "Opens after you say thanks", me: "Opens after you look around" };
    const places = w.places.map((p) => (hints[p.id] ? { ...p, hint: hints[p.id] } : p));
    const signs = signPoints(places, [], hogsOf(w));
    // On screen at 2x: the name in 14 px Pixelify (8 px a letter), the hint in 12 px Nunito (6.5 px a
    // letter), 8 px padding a side, 40 px tall with both lines.
    const box = (id: string) => {
      const p = places.find((q) => q.id === id)!;
      const half = (Math.max(p.name.length * 8, hints[id].length * 6.5) + 16) / 2;
      const at = signs.get(id)!;
      return { x0: at.x * 2 - half, x1: at.x * 2 + half, y0: at.y * 2 - 40, y1: at.y * 2 };
    };
    const [a, b] = [box("offering"), box("me")];
    expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false);
  });
});

describe("the elder hog", () => {
  test("sits on its mat in base camp, a place of its own", () => {
    expect(elderOf(world(["elder"]))).toEqual({ x: 6, y: 2 });
    expect(elderOf(world([]))).toBeNull();
  });
});
