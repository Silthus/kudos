import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The quest signpost: a wooden post with three arms, this week's quests. */
function signpost() {
  const c = new PixelCanvas(22, 32);
  c.polygon([[3, 27], [11, 23], [19, 27], [11, 31]], "G"); // a tuft of hedge at its foot
  c.rect(10, 4, 3, 24, "b").rect(10, 4, 1, 24, "s");
  const arm = (x: number, y: number, w: number, right: boolean) => {
    c.rect(x, y, w, 4, "p").rect(x, y + 3, w, 1, "P");
    const tip = right ? x + w : x - 1;
    c.rect(tip, y + 1, 1, 2, "p");
    c.rect(x + 2, y + 1, w - 4, 1, "P"); // the writing, too small to read
  };
  arm(12, 5, 8, true);
  arm(2, 11, 8, false);
  arm(12, 17, 7, true);
  c.set(11, 3, "l").set(11, 2, "l"); // a lantern tip on the post
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "quests",
  name: "Quest signpost",
  footprint: { x: 19, y: 24, w: 1, h: 1 },
  doors: [{ x: 20, y: 24 }],
  sprite: signpost(),
};
