import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The sandbox (#133): a low wooden frame of sand with a bucket, a spade and a sandcastle, and at the
 * back a little terminal on a post, standing in the sand: the Slack playground, where you try
 * giving kudos for real. Our own art, no hedgehog.
 */
function sandbox() {
  const c = new PixelCanvas(48, 40);
  const box = c.isoBox(2, 2, 4, { left: "s", right: "b", top: "P" }, 39, 8);
  // The frame's top edge in pale wood, and the sand a little uneven.
  c.polygon([box.L, box.B, [box.B[0], box.B[1] + 1], [box.L[0], box.L[1] + 1]], "s").polygon([box.B, box.R, [box.R[0], box.R[1] + 1], [box.B[0], box.B[1] + 1]], "b");
  c.polygon([[box.T[0], box.T[1] + 2], [box.R[0] - 3, box.R[1]], [box.B[0], box.B[1] - 2], [box.L[0] + 3, box.L[1]]], "P");
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) if (c.get(x, y) === "P" && (x * 7 + y * 3) % 11 === 0) c.set(x, y, "p");
  const [cx, cy] = [box.B[0], (box.T[1] + box.B[1]) / 2];

  // The terminal at the back: a bark post, a dusk screen with a lantern cursor and two lines of text.
  c.rect(cx - 1, cy - 8, 2, 8, "b").rect(cx - 3, cy - 1, 6, 1, "s");
  c.rect(cx - 7, cy - 19, 14, 11, "b").rect(cx - 6, cy - 18, 12, 9, "d");
  c.rect(cx - 5, cy - 16, 7, 1, "c").rect(cx - 5, cy - 14, 5, 1, "m").rect(cx - 5, cy - 12, 3, 1, "c").rect(cx - 1, cy - 12, 1, 2, "l");

  // The bucket, its handle and a spill of sand; the spade stuck in the sand; a sandcastle with a flag.
  c.rect(cx - 12, cy + 1, 6, 5, "e").rect(cx - 12, cy + 1, 6, 1, "E").rect(cx - 11, cy + 6, 4, 1, "E");
  c.set(cx - 12, cy, "k").set(cx - 7, cy, "k").rect(cx - 11, cy - 1, 4, 1, "k");
  c.rect(cx - 6, cy + 5, 2, 1, "p");
  c.rect(cx + 9, cy - 4, 1, 7, "b").rect(cx + 8, cy + 3, 3, 3, "m").set(cx + 9, cy + 5, "M");
  c.polygon([[cx - 1, cy + 8], [cx + 3, cy + 6], [cx + 7, cy + 8], [cx + 3, cy + 10]], "p");
  c.rect(cx + 1, cy + 3, 5, 4, "P").rect(cx + 1, cy + 2, 1, 1, "P").rect(cx + 3, cy + 2, 1, 1, "P").rect(cx + 5, cy + 2, 1, 1, "P").rect(cx + 3, cy + 5, 1, 2, "s");
  c.rect(cx + 3, cy - 1, 1, 3, "b").rect(cx + 4, cy - 1, 2, 1, "l");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "playground",
  name: "The sandbox",
  footprint: { x: -1, y: -1, w: 2, h: 2 },
  doors: [{ x: 0, y: 1 }],
  sprite: sandbox(),
};
