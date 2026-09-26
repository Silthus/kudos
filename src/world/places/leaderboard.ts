import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The notice board: a cork board on two posts under a little red roof, with the standings pinned
 * to it on parchment papers, each held by a lantern or ember pin.
 */
function noticeBoard() {
  const c = new PixelCanvas(36, 40);
  c.polygon([[3, 36], [18, 30], [33, 36], [18, 40]], "G"); // trodden hedge at its feet
  // Two posts.
  c.rect(6, 12, 3, 27, "b").rect(6, 12, 1, 27, "s");
  c.rect(27, 12, 3, 27, "b").rect(27, 12, 1, 27, "s");
  // The board: a bark frame round soil cork.
  c.rect(3, 12, 30, 20, "b").rect(5, 14, 26, 16, "s");
  for (let y = 14; y < 30; y++) for (let x = 5; x < 31; x++) if ((x * 7 + y * 3) % 11 === 0) c.set(x, y, "E");
  /** A paper with a few lines of writing, pinned at its top. */
  const paper = (x: number, y: number, w: number, h: number, pin: string, face = "p") => {
    c.rect(x, y, w, h, face).rect(x + 1, y + h, w, 1, "k"); // a dark edge under it on the cork
    for (let j = y + 3; j < y + h - 1; j += 2) c.rect(x + 1, j, w - 2 - ((j - y) % 3), 1, "M");
    c.set(x + Math.floor(w / 2), y + 1, pin);
  };
  paper(7, 15, 8, 9, "l"); // the standings, the biggest paper
  paper(17, 16, 6, 6, "e", "P");
  paper(24, 15, 6, 8, "l");
  paper(16, 23, 7, 5, "l");
  paper(9, 25, 5, 4, "e", "P");
  // The roof: a red gable with a bark ridge beam.
  c.polygon([[0, 13], [18, 4], [36, 13], [36, 14], [0, 14]], "e");
  for (let x = 0; x < 36; x++) for (let y = 4; y < 14; y++) if (c.get(x, y) === "e" && (x + y) % 5 === 0) c.set(x, y, "E");
  c.rect(0, 12, 36, 2, "E");
  c.rect(17, 3, 2, 2, "b");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "leaderboard",
  name: "Notice board",
  footprint: { x: -1, y: 0, w: 2, h: 1 },
  doors: [{ x: 1, y: 0 }],
  sprite: noticeBoard(),
};
