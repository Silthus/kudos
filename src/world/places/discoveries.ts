import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The gallery: a small stone hall with a blue roof and rarity banners, the message collection. */
function gallery() {
  const c = new PixelCanvas(46, 50);
  const box = c.isoBox(3, 2, 14, { left: "m", right: "M", top: "M" }, 49, 3);
  c.wall(box, "left", 0, 0, 24, 2, "M"); // a plinth
  // Banners in the rarity colours along the long wall, lit windows between.
  const banner = (u: number, colour: string) => c.wall(box, "left", u, 4, 3, 9, colour).wall(box, "left", u + 1, 3, 1, 1, colour);
  banner(3, "v");
  banner(10, "w");
  banner(17, "l");
  c.wall(box, "left", 7, 8, 2, 3, "l").wall(box, "left", 14, 8, 2, 3, "l");
  // The arched door on the short wall, where you come in.
  c.wall(box, "right", 5, 0, 6, 10, "k").wall(box, "right", 6, 0, 4, 9, "b").wall(box, "right", 7, 10, 2, 1, "k");
  const eave = { ...box, T: [box.T[0], box.T[1] - 1] as [number, number], R: [box.R[0] + 2, box.R[1]] as [number, number], B: [box.B[0], box.B[1] + 2] as [number, number], L: [box.L[0] - 2, box.L[1]] as [number, number] };
  c.hipRoof(eave, 10, { front: "W", side: "w", back: "W" });
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "discoveries",
  name: "The gallery",
  footprint: { x: 6, y: 7, w: 3, h: 2 },
  doors: [{ x: 9, y: 8 }],
  sprite: gallery(),
};
