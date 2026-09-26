import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The gallery: a small stone hall with pale columns and lit windows, rarity banners between them,
 * a blue roof, and a long banner flying from the ridge over the door, the message collection.
 */
function gallery() {
  const c = new PixelCanvas(48, 62);
  const box = c.isoBox(3, 2, 15, { left: "m", right: "M", top: "M" }, 61, 4);
  c.wall(box, "left", 0, 0, 24, 2, "M").wall(box, "right", 0, 0, 16, 2, "k"); // a plinth
  // Columns along the long wall, with the rarity banners and lit windows between them.
  for (const u of [1, 8, 15, 22]) c.wall(box, "left", u, 2, 1, 13, "c");
  const banner = (u: number, colour: string) => c.wall(box, "left", u, 5, 3, 8, colour).wall(box, "left", u + 1, 4, 1, 1, colour);
  banner(3, "v");
  banner(17, "w");
  c.wall(box, "left", 11, 7, 2, 4, "l");
  // A lintel under the eaves.
  c.wall(box, "left", 0, 14, 24, 1, "P").wall(box, "right", 0, 14, 16, 1, "m");
  // The arched door on the short wall, where you come in.
  c.wall(box, "right", 5, 2, 6, 10, "k").wall(box, "right", 6, 2, 4, 9, "b").wall(box, "right", 7, 12, 2, 1, "k").wall(box, "right", 8, 6, 1, 1, "l");
  const eave = { ...box, T: [box.T[0], box.T[1] - 1] as [number, number], R: [box.R[0] + 2, box.R[1]] as [number, number], B: [box.B[0], box.B[1] + 2] as [number, number], L: [box.L[0] - 2, box.L[1]] as [number, number] };
  const apex = c.hipRoof(eave, 10, { front: "W", side: "w", back: "W" });
  // The banner: a pole on the ridge and a long pennant in the legendary colours.
  const [px, py] = [Math.round(apex[0]), Math.round(apex[1])];
  c.rect(px, py - 12, 1, 13, "b").set(px, py - 13, "l");
  for (let i = 0; i < 12; i++) {
    const h = Math.max(1, 5 - Math.floor(i / 3));
    c.rect(px + 1 + i, py - 12 + Math.floor(i / 4), 1, h, i < 4 ? "l" : "e");
  }
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "discoveries",
  name: "The gallery",
  footprint: { x: -1, y: -1, w: 3, h: 2 },
  doors: [{ x: 2, y: 0 }],
  sprite: gallery(),
};
