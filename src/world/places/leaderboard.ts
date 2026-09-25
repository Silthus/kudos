import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The notice board: a roofed board on two legs with the standings pinned to it. */
function noticeBoard() {
  const c = new PixelCanvas(34, 38);
  // Legs.
  c.rect(9, 26, 2, 10, "b").rect(23, 22, 2, 10, "b");
  const board = c.isoBox(2, 0.5, 15, { left: "s", right: "b", top: "b" }, 30, 3);
  c.wall(board, "left", 1, 1, 14, 13, "b");
  // Papers, each held by a lantern pin.
  const paper = (u: number, v: number, w: number, h: number) => c.wall(board, "left", u, v, w, h, "p").wall(board, "left", u + 1, v + h - 1, 1, 1, "l");
  paper(2, 7, 5, 6);
  paper(8, 8, 5, 5);
  paper(3, 2, 4, 4);
  paper(9, 2, 5, 5);
  c.hipRoof({ ...board, T: [board.T[0], board.T[1] - 1], L: [board.L[0] - 2, board.L[1]], R: [board.R[0] + 2, board.R[1]], B: [board.B[0], board.B[1] + 2] }, 4, { front: "E", side: "e", back: "E" });
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "leaderboard",
  name: "Notice board",
  footprint: { x: 24, y: 24, w: 2, h: 1 },
  doors: [{ x: 26, y: 24 }],
  sprite: noticeBoard(),
};
