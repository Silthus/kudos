import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The observatory: a stone tower under a blue dome with a lit slit, where the team's numbers are read. */
function observatory() {
  const c = new PixelCanvas(38, 64);
  const box = c.isoBox(2, 2, 28, { left: "m", right: "M", top: "M" }, 63, 3);
  for (const v of [9, 19]) {
    c.wall(box, "left", 0, v, 16, 1, "M");
    c.wall(box, "right", 0, v, 16, 1, "k");
  }
  c.wall(box, "left", 5, 0, 6, 10, "k").wall(box, "left", 6, 0, 4, 9, "b"); // the door, where you come in
  c.wall(box, "left", 7, 13, 2, 4, "l").wall(box, "right", 7, 22, 2, 4, "l");
  // The dome: its lower half hidden behind the tower's top, a lit slit and the telescope.
  const cx = box.B[0];
  const cy = box.T[1] + 8;
  c.disc(cx, cy, 13, "W");
  for (let y = cy + 2; y < 64; y++) for (let x = 0; x < 38; x++) if (c.get(x, y) === "W") c.set(x, y, "M");
  c.disc(cx - 4, cy - 5, 4, "w").rect(cx - 1, cy - 12, 3, 13, "l").rect(cx + 2, cy - 14, 6, 2, "b");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "analytics",
  name: "The observatory",
  footprint: { x: 14, y: 1, w: 2, h: 2 },
  doors: [{ x: 15, y: 3 }],
  sprite: observatory(),
};
