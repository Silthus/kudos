import { describe, expect, it } from "vitest";
import { placementOf } from "./floatingCard";

const room = { top: 72, bottom: 800, width: 1280 };

const card = { width: 272, height: 300 };

function anchorAt(top: number, left = 500) {
  return { top, bottom: top + 120, left, width: 140 };
}

describe("HH85: the card floats below or above its anchor, whichever fits between the top bar and the bottom of the screen", () => {
  it("goes below its anchor when it fits there", () => {
    expect(placementOf(anchorAt(200), card, room)).toEqual({ side: "below", top: 328, left: 434 });
  });

  it("goes above its anchor when it doesn't fit below but fits above", () => {
    expect(placementOf(anchorAt(500), card, room)).toEqual({ side: "above", top: 192, left: 434 });
  });

  it("takes the roomier side and stays inside the room when it fits on neither", () => {
    const tall = { width: 272, height: 600 };

    expect(placementOf(anchorAt(300), tall, room)).toEqual({ side: "below", top: 200, left: 434 });
    expect(placementOf(anchorAt(500), tall, room)).toEqual({ side: "above", top: 72, left: 434 });
  });

  it("never starts under the top bar while its anchor scrolls up behind it", () => {
    expect(placementOf(anchorAt(-200), card, room).top).toBe(72);
  });

  it("stays inside the screen's sides", () => {
    expect(placementOf(anchorAt(200, 4), card, room).left).toBe(8);
    expect(placementOf(anchorAt(200, 1200), card, room).left).toBe(1000);
  });
});
