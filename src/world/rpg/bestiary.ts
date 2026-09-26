import type { CreatureId } from "../../../convex/lib/rpg";
import { PixelCanvas, type PixelMap } from "../pixels";

/**
 * The twelve desert creatures of the ruins (#162, lib/rpg.ts `BESTIARY`) in our own pixels, drawn
 * in code in the #152 palette: 32 × 28 each, facing left towards the party, standing on the room's
 * floor line (the bottom row). The blight's own creatures are `blight` purple; everything else is
 * the desert's sand, stone, glass and bark. Never a hedgehog.
 */

const W = 32;
const H = 28;

function scarab() {
  const c = new PixelCanvas(W, H);
  c.disc(17, 15, 10, "D");
  c.disc(16, 13, 8.5, "A");
  c.rect(16, 5, 1, 18, "D"); // the split between the wing cases
  c.disc(12, 10, 2.2, "a").set(21, 9, "a").set(22, 10, "a");
  // Six jointed legs, out from under the shell.
  for (const [x, dir] of [[10, -1], [16, 0], [22, 1]] as const) {
    c.rect(x, 23, 1, 3, "n").set(x + dir, 26, "n").set(x + dir * 2, 27, "n");
  }
  // The head and its horn, towards the party, with a glint of an eye.
  c.disc(5, 17, 4, "n");
  c.polygon([[1, 13], [4, 10], [6, 14]], "n");
  c.set(4, 16, "l").set(5, 16, "c");
  c.rect(1, 20, 3, 1, "n").rect(1, 21, 1, 2, "n");
  return c.outline().map();
}

function wisp() {
  const c = new PixelCanvas(W, H);
  // A flame of heat haze with a trailing tail.
  c.polygon([[10, 6], [18, 2], [24, 8], [26, 18], [20, 24], [12, 24], [7, 17]], "l");
  c.polygon([[20, 24], [28, 22], [31, 26], [22, 27]], "l");
  c.polygon([[12, 9], [18, 5], [22, 10], [22, 19], [15, 21], [10, 17]], "c");
  // Two dark eyes and the teeth.
  c.rect(12, 12, 2, 3, "k").rect(17, 12, 2, 3, "k");
  c.rect(12, 18, 7, 1, "k");
  c.set(13, 19, "c").set(15, 19, "c").set(17, 19, "c");
  return c.outline("e").map();
}

function blightSprout() {
  const c = new PixelCanvas(W, H);
  // Roots gripping the floor, the soil heaved up round them.
  c.polygon([[8, 27], [12, 23], [20, 23], [25, 27]], "s");
  c.set(7, 26, "x").set(6, 27, "x").set(25, 26, "x").set(26, 27, "x");
  // A crooked stem.
  c.polygon([[15, 24], [14, 16], [16, 11], [18, 11], [17, 17], [18, 24]], "x");
  // Two curled leaves, thorned at the tips.
  c.polygon([[15, 18], [9, 16], [4, 11], [6, 10], [11, 13], [15, 15]], "x");
  c.polygon([[17, 16], [22, 12], [28, 11], [27, 13], [22, 16], [18, 18]], "x");
  c.set(4, 10, "v").set(28, 10, "v").set(8, 14, "v").set(24, 13, "v");
  // A swollen bud that opens into a mouth with a ring of teeth.
  c.disc(17, 7, 6, "x");
  c.disc(16, 6, 3, "v");
  c.polygon([[13, 8], [17, 5], [21, 8], [17, 11]], "k");
  c.set(14, 8, "c").set(16, 9, "c").set(18, 9, "c").set(20, 8, "c");
  c.set(15, 4, "e").set(19, 4, "e");
  return c.outline().map();
}

function saltHare() {
  const c = new PixelCanvas(W, H);
  // The body, crouched to spring.
  c.disc(19, 20, 7, "c");
  c.disc(23, 22, 4, "p");
  // Long ears, one bent.
  c.polygon([[10, 12], [9, 1], [12, 1], [13, 12]], "c");
  c.polygon([[13, 12], [17, 3], [19, 4], [15, 13]], "p");
  c.rect(10, 3, 1, 7, "P");
  c.disc(11, 15, 4.5, "c");
  c.set(9, 14, "k").set(7, 16, "e");
  // Salt crystals on its back.
  c.set(18, 14, "m").set(21, 15, "m").set(24, 17, "M").set(20, 13, "w");
  c.rect(12, 25, 4, 2, "c").rect(22, 25, 5, 2, "c");
  return c.outline().map();
}

function glassScorpion() {
  const c = new PixelCanvas(W, H);
  // Segments of glass, then the tail curling over.
  c.disc(14, 21, 5, "w");
  c.disc(21, 21, 4, "w");
  c.disc(26, 18, 3, "w");
  c.disc(27, 12, 2.5, "w");
  c.disc(24, 7, 2.5, "w");
  c.polygon([[19, 4], [22, 5], [20, 9]], "c");
  // Claws reaching for the party.
  c.polygon([[9, 20], [3, 15], [2, 19], [7, 22]], "w");
  c.rect(1, 14, 3, 2, "W").rect(1, 19, 3, 2, "W");
  // Glints you only see too late.
  c.set(13, 19, "c").set(20, 19, "c").set(26, 16, "c");
  c.set(10, 20, "k");
  for (const x of [12, 16, 20]) c.rect(x, 25, 1, 3, "W");
  return c.outline("W").map();
}

function hollowSentinel() {
  const c = new PixelCanvas(W, H);
  // A stone statue on a plinth, its spear still held.
  c.rect(9, 24, 14, 4, "M");
  c.rect(11, 10, 10, 14, "m");
  c.rect(17, 10, 4, 14, "M");
  c.rect(12, 3, 8, 8, "m");
  c.rect(17, 3, 3, 8, "M");
  // The eye slits, lit from nowhere.
  c.rect(13, 6, 2, 1, "l").rect(17, 6, 2, 1, "l");
  // Cracks and the spear.
  c.set(14, 14, "k").set(15, 15, "k").set(14, 16, "k");
  c.rect(6, 2, 1, 24, "b");
  c.polygon([[4, 3], [6, -1], [8, 3]], "m");
  c.rect(7, 13, 4, 2, "m");
  return c.outline().map();
}

function thirstShade() {
  const c = new PixelCanvas(W, H);
  // A shadow with no feet, reaching out.
  c.polygon([[12, 3], [20, 3], [24, 10], [25, 22], [22, 27], [18, 24], [14, 27], [10, 23], [9, 12]], "d");
  c.polygon([[10, 12], [2, 14], [3, 17], [11, 16]], "d");
  c.polygon([[1, 13], [3, 12], [3, 18], [1, 18]], "x");
  c.rect(13, 5, 7, 5, "x");
  c.rect(13, 7, 2, 2, "e").rect(18, 7, 2, 2, "e");
  c.polygon([[14, 12], [19, 12], [16, 16]], "k");
  return c.outline("x").map();
}

function kilnBeetle() {
  const c = new PixelCanvas(W, H);
  for (const x of [8, 14, 20, 25]) c.rect(x, 22, 2, 5, "k");
  c.disc(17, 16, 11, "E");
  c.disc(16, 15, 9, "e");
  // Cracks glowing with the heat inside.
  c.rect(16, 7, 1, 17, "l");
  c.polygon([[9, 14], [12, 13], [13, 16]], "l");
  c.polygon([[20, 12], [24, 14], [21, 16]], "l");
  c.disc(6, 19, 4, "E");
  c.set(4, 18, "l").set(3, 21, "c");
  return c.outline().map();
}

function stormDjinn() {
  const c = new PixelCanvas(W, H);
  // A whirl of sand: bands winding down from broad shoulders to a spinning point.
  const bands: [number, number, string][] = [[12, 22, "A"], [15, 18, "a"], [18, 14, "A"], [21, 10, "a"], [24, 6, "A"]];
  for (const [y, w, tone] of bands) c.rect(16 - w / 2 + (y % 2), y, w, 3, tone);
  c.rect(15, 27, 2, 1, "D");
  for (const y of [14, 17, 20, 23]) c.rect(16 - (26 - y) / 2 + 2, y, (26 - y) / 1.5, 1, "D");
  // Arms of wind thrown wide.
  c.polygon([[6, 13], [1, 6], [3, 4], [9, 12]], "a");
  c.polygon([[26, 13], [31, 6], [29, 4], [23, 12]], "a");
  // The head in its hood of dust, with violet eyes.
  c.disc(16, 7, 5.5, "A");
  c.disc(16, 8, 4, "a");
  c.rect(13, 7, 2, 2, "v").rect(18, 7, 2, 2, "v");
  c.rect(14, 11, 5, 1, "D");
  c.set(0, 9, "a").set(31, 9, "a").set(2, 1, "D").set(29, 1, "D");
  return c.outline().map();
}

function rootWyrm() {
  const c = new PixelCanvas(W, H);
  // A serpent of root-wood: its tail coiled on the floor, its body rising in an S to the head.
  c.disc(23, 22, 6, "b");
  c.disc(23, 22, 3, "B");
  c.polygon([[17, 23], [13, 18], [17, 13], [21, 16], [18, 19], [20, 22]], "b");
  c.polygon([[17, 13], [13, 9], [15, 6], [20, 10]], "B");
  c.disc(10, 7, 5, "B");
  c.polygon([[6, 6], [1, 8], [2, 10], [6, 10]], "B");
  c.rect(2, 9, 4, 1, "k");
  c.set(3, 10, "c").set(5, 10, "c");
  c.rect(9, 5, 2, 2, "y");
  // Rootlets sprouting from its back, and a leaf.
  c.set(14, 4, "b").set(13, 3, "b").set(12, 2, "b");
  c.set(20, 12, "b").set(21, 11, "b").set(27, 16, "b").set(28, 15, "b").set(29, 26, "b");
  c.set(12, 1, "g").set(11, 1, "u");
  return c.outline().map();
}

function silentChoir() {
  const c = new PixelCanvas(W, H);
  // Three pale singers, hoods up, mouths open and making no sound.
  const singer = (x: number, top: number, tone: string) => {
    c.polygon([[x - 5, 27], [x - 4, top + 6], [x, top], [x + 4, top + 6], [x + 5, 27]], tone);
    c.rect(x - 2, top + 5, 4, 5, "k");
    c.rect(x - 1, top + 11, 2, 3, "d");
  };
  singer(8, 6, "p");
  singer(24, 5, "p");
  singer(16, 2, "c");
  c.set(16, 18, "v").set(8, 20, "v").set(24, 20, "v");
  return c.outline().map();
}

function blightHeart() {
  const c = new PixelCanvas(W, H);
  // The blight's heart: a swollen mass of purple, veined, with a buried ember that still beats.
  c.disc(10, 11, 8, "x");
  c.disc(22, 11, 8, "x");
  c.polygon([[3, 14], [29, 14], [16, 27]], "x");
  c.polygon([[16, 5], [13, 12], [16, 18], [11, 22]], "v");
  c.polygon([[22, 6], [25, 12], [21, 16]], "v");
  c.disc(16, 14, 3.5, "E");
  c.disc(16, 14, 2, "e");
  c.set(16, 13, "l");
  c.set(8, 7, "v").set(24, 8, "d").set(6, 16, "d");
  // Tendrils into the floor.
  c.set(9, 24, "x").set(8, 25, "x").set(23, 24, "x").set(24, 25, "x");
  return c.outline().map();
}

export const CREATURE_ART: Record<CreatureId, PixelMap> = {
  sand_scarab: scarab(),
  dune_wisp: wisp(),
  blight_sprout: blightSprout(),
  salt_hare: saltHare(),
  glass_scorpion: glassScorpion(),
  hollow_sentinel: hollowSentinel(),
  thirst_shade: thirstShade(),
  kiln_beetle: kilnBeetle(),
  storm_djinn: stormDjinn(),
  root_wyrm: rootWyrm(),
  silent_choir: silentChoir(),
  blight_heart: blightHeart(),
};

/** A creature not met yet: its outline only, filled with shadow. */
export function unmetArt(id: CreatureId): PixelMap {
  const m = CREATURE_ART[id];
  return { rows: m.rows.map((row) => row.replace(/[^.]/g, (ch) => (ch === "." ? "." : "d"))) };
}
