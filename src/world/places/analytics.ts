import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The observatory: a round-shouldered stone tower under a blue dome, where the team's numbers are
 * read. A brass ring holds the dome, its shutter stands open on a lit slit, and the telescope
 * points out of it at the sky; lit windows climb the tower to the door.
 */
function observatory() {
  const c = new PixelCanvas(40, 68);
  const box = c.isoBox(2, 2, 30, { left: "m", right: "M", top: "M" }, 67, 4);
  // Courses of stone, and a plinth.
  for (const v of [10, 20]) c.wall(box, "left", 0, v, 16, 1, "M").wall(box, "right", 0, v, 16, 1, "k");
  c.wall(box, "left", 0, 0, 16, 2, "M").wall(box, "right", 0, 0, 16, 2, "k");
  // The door, where you come in, under a lit fanlight; windows up the tower.
  c.wall(box, "left", 5, 2, 6, 10, "k").wall(box, "left", 6, 2, 4, 9, "b").wall(box, "left", 7, 12, 2, 1, "l");
  c.wall(box, "left", 7, 15, 2, 4, "l").wall(box, "right", 7, 13, 2, 4, "l").wall(box, "right", 7, 24, 2, 4, "l");
  // The dome: its lower half hidden behind the tower's top.
  const cx = box.B[0];
  const cy = box.T[1] + 8;
  c.disc(cx, cy, 14, "W");
  for (let y = cy + 2; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) === "W") c.set(x, y, "M");
  c.disc(cx - 5, cy - 5, 4, "w"); // the dome's shine
  for (const dx of [-9, 8]) for (let y = cy - 10; y < cy + 2; y++) if (c.get(cx + dx, y) === "W") c.set(cx + dx, y, "k"); // its ribs
  // The brass ring at the dome's foot.
  for (let x = cx - 14; x <= cx + 14; x++) if (c.get(x, cy + 1) !== ".") c.set(x, cy + 1, "l").set(x, cy + 2, "E");
  // The shutter, open on a lit slit, and the telescope leaning out of it.
  c.rect(cx - 1, cy - 13, 4, 14, "l").rect(cx + 3, cy - 13, 1, 14, "k");
  for (let i = 0; i < 16; i++) c.rect(cx + 1 + i, cy - 7 - Math.floor(i / 2), 2, 2, i > 13 ? "c" : i === 8 ? "l" : "b");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "analytics",
  name: "The observatory",
  footprint: { x: 14, y: 1, w: 2, h: 2 },
  doors: [{ x: 15, y: 3 }],
  sprite: observatory(),
};
