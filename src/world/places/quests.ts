import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The quest signpost: a wooden post with three pointed arms, one for each of this week's quests,
 * a lantern on top and stones at its foot.
 */
function signpost() {
  const c = new PixelCanvas(26, 36);
  c.polygon([[4, 31], [13, 27], [22, 31], [13, 35]], "G"); // a tuft of hedge at its foot
  c.rect(7, 30, 3, 2, "M").rect(16, 31, 3, 2, "m").rect(17, 31, 2, 1, "M");
  // The post, lit on its left edge, with a cap and a lantern.
  c.rect(12, 6, 3, 26, "b").rect(12, 6, 1, 26, "s");
  c.rect(11, 5, 5, 1, "b");
  c.rect(12, 2, 3, 3, "l").set(13, 1, "b").set(13, 3, "c");
  /** One arm: a plank with a pointed end and three strokes of writing. */
  const arm = (x: number, y: number, w: number, right: boolean, face: string) => {
    c.rect(x, y, w, 5, face).rect(x, y + 4, w, 1, "P");
    const tip = right ? x + w : x - 1;
    const step = right ? 1 : -1;
    c.rect(tip, y + 1, 1, 3, face).set(tip + step, y + 2, face);
    const text = right ? x + 2 : x + 1;
    c.rect(text, y + 2, 2, 1, "s").rect(text + 3, y + 2, w - 7, 1, "s");
    c.set(right ? x : x + w - 1, y + 2, "b"); // the nail
  };
  arm(15, 7, 8, true, "p");
  arm(3, 13, 9, false, "p");
  arm(15, 19, 7, true, "P");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "quests",
  name: "Quest signpost",
  footprint: { x: 19, y: 24, w: 1, h: 1 },
  doors: [{ x: 20, y: 24 }],
  sprite: signpost(),
};
