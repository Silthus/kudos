import { PixelCanvas, type PixelMap } from "../pixels";

/**
 * The rooms of a ruin (#162) in our own pixels: a backdrop per tier (the near ruins' sandstone, the
 * far ruins' grey stone, the deep ruins' dark with blight in the cracks), and what stands in each
 * kind of room: nothing but the floor for a foe (the creature stands on it), a stone tablet for a
 * puzzle, an alcove with a glinting chest for a secret, a campfire by a pool for a rest.
 */
export const SCENE = { width: 120, height: 56, floor: 44 } as const;

type Tones = { wall: string; shade: string; floor: string; joint: string; crack: string };
const TIER_TONES: Record<number, Tones> = {
  1: { wall: "A", shade: "D", floor: "n", joint: "D", crack: "b" },
  2: { wall: "m", shade: "M", floor: "M", joint: "M", crack: "k" },
  3: { wall: "d", shade: "k", floor: "k", joint: "i", crack: "x" },
};

function backdrop(tier: number): PixelCanvas {
  const t = TIER_TONES[tier] ?? TIER_TONES[1];
  const { width: w, height: h, floor } = SCENE;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, floor, t.wall);
  // Courses of stone, each row offset.
  for (let y = 7; y < floor; y += 7) {
    c.rect(0, y, w, 1, t.joint);
    for (let x = (y / 7) % 2 ? 6 : 0; x < w; x += 12) c.rect(x, y - 6, 1, 6, t.joint);
  }
  // A shaded top and a dark doorway to the next room.
  c.rect(0, 0, w, 3, t.shade);
  c.rect(52, 14, 16, floor - 14, "k");
  c.polygon([[52, 14], [60, 8], [68, 14]], "k");
  // Cracks, with blight in them in the deep ruins.
  c.set(20, 12, t.crack).set(21, 13, t.crack).set(21, 14, t.crack).set(96, 30, t.crack).set(97, 31, t.crack).set(98, 31, t.crack);
  // Two lit sconces.
  for (const x of [40, 72]) c.rect(x, 18, 3, 4, "b").rect(x, 15, 3, 3, "l").set(x + 1, 14, "c");
  // The floor, in slabs.
  c.rect(0, floor, w, h - floor, t.floor);
  for (let x = 4; x < w; x += 16) c.rect(x, floor + 3, 10, 1, t.shade === "k" ? "d" : t.shade);
  c.rect(0, floor, w, 1, "k");
  return c;
}

function tablet(c: PixelCanvas) {
  // A standing stone tablet, runes of sap cut into it.
  c.rect(49, 18, 22, 26, "m").rect(66, 18, 5, 26, "M");
  c.polygon([[49, 18], [60, 12], [71, 18]], "m");
  for (let y = 22; y < 40; y += 4) c.rect(53, y, 10, 1, y % 8 === 2 ? "y" : "k");
  c.rect(46, 43, 28, 2, "M");
}

function alcove(c: PixelCanvas) {
  // An alcove in the wall, and a chest in it with a glint.
  c.rect(44, 20, 32, 24, "k");
  c.polygon([[44, 20], [60, 12], [76, 20]], "k");
  c.rect(50, 32, 20, 12, "b").rect(50, 32, 20, 3, "B").rect(58, 36, 4, 3, "l");
  c.rect(50, 35, 20, 1, "k");
  // The glint.
  c.set(66, 27, "c").set(65, 28, "c").set(67, 28, "c").set(66, 29, "c").set(66, 26, "l").set(66, 30, "l");
}

function camp(c: PixelCanvas) {
  // A pool of water and a small fire beside it.
  c.polygon([[24, 49], [36, 46], [56, 46], [64, 49], [54, 53], [30, 53]], "w");
  c.rect(34, 49, 12, 1, "c");
  c.rect(78, 46, 16, 3, "b");
  c.polygon([[80, 46], [86, 34], [92, 46]], "e");
  c.polygon([[83, 46], [86, 38], [89, 46]], "l");
  c.set(86, 41, "c");
}

/** The room strip's little pictures, 9 × 9: a tablet, a fire, a glint, and a room not reached yet. */
export const ROOM_ICONS: Record<"puzzle" | "rest" | "secret" | "unknown", PixelMap> = {
  puzzle: { rows: ["..kkkkk..", ".kmmmmmk.", ".kmkkkmk.", ".kmmmmmk.", ".kmyyymk.", ".kmmmmmk.", ".kmkkkmk.", ".kmmmmmk.", "kkkkkkkkk"] },
  rest: { rows: ["....k....", "...kek...", "...kek...", "..kelek..", "..kelek..", ".kellcek.", ".keeeeek.", "kbbbbbbbk", ".kkkkkkk."] },
  secret: { rows: ["....l....", "....c....", "..lcccl..", "....c....", "....l....", ".kkkkkkk.", ".kBBBBBk.", ".kbblbbk.", ".kkkkkkk."] },
  unknown: { rows: [".........", "...ccc...", "..c...c..", "......c..", ".....c...", "....c....", ".........", "....c....", "........."] },
};

export function sceneFor(kind: "foe" | "puzzle" | "secret" | "rest", tier: number): PixelMap {
  const c = backdrop(tier);
  if (kind === "puzzle") tablet(c);
  if (kind === "secret") alcove(c);
  if (kind === "rest") camp(c);
  return c.map();
}
