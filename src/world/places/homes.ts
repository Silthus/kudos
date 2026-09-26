import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The homes district's gate (#160): a timber arch at the start of the homes ring, a parchment board
 * with a little house painted on it hanging from the crossbeam, and a lantern on each post. Your
 * home's window opens here: buy a plot, build your next stage, read your guestbook. The homes
 * themselves stand on the ring's plots, further out (`world.homes`).
 */
function gate() {
  const c = new PixelCanvas(30, 36);
  // Two posts and the crossbeam.
  c.rect(5, 8, 3, 28, "b").rect(22, 8, 3, 28, "b").rect(6, 9, 1, 26, "B").rect(23, 9, 1, 26, "B");
  c.rect(2, 6, 26, 3, "B").rect(2, 8, 26, 1, "b");
  // The board on two cords.
  c.set(10, 9, "P").set(10, 10, "P").set(19, 9, "P").set(19, 10, "P");
  c.rect(8, 11, 14, 11, "p").rect(8, 21, 14, 1, "P");
  // A little house painted on it: a red roof, a lit window.
  c.polygon([[10, 16], [15, 12], [20, 16]], "e");
  c.rect(11, 16, 8, 4, "B").rect(14, 17, 2, 2, "l");
  // Lanterns on the posts.
  c.rect(4, 4, 2, 2, "l").set(4, 3, "b").rect(24, 4, 2, 2, "l").set(25, 3, "b");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "homes",
  name: "The homes",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: gate(),
};
