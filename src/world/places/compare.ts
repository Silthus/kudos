import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** A steady pseudo-random number in [0, 1) for a pixel, so the stones and grass never shuffle. */
const noise = (x: number, y: number, salt: number) => {
  const h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791), 2654435761) >>> 0;
  return (h % 1000) / 1000;
};

/**
 * The mirror pond: the water is the world's own (the footprint floods), this sprite makes it round.
 * Lawn fills the footprint's corners, a ring of rim stones holds the water, shallows light its
 * front edge, and it mirrors what stands over it: the moon broken into ripples, and the reeds on
 * its far bank hanging upside down in the water.
 */
function mirrorPond() {
  const c = new PixelCanvas(62, 44);
  // The footprint diamond, 4 tiles along x and 3 along y, from its back corner T.
  const T = [27, 15];
  const X = [32, 16];
  const Y = [-24, 12];
  const det = X[0] * Y[1] - X[1] * Y[0];
  /** A pixel's place on the footprint: (0..1, 0..1) inside it. */
  const local = (px: number, py: number) => {
    const dx = px - T[0];
    const dy = py - T[1];
    return [(dx * Y[1] - dy * Y[0]) / det, (X[0] * dy - X[1] * dx) / det];
  };
  /** Where a point of the footprint lands on the sprite. */
  const at = (a: number, b: number) => [Math.round(T[0] + a * X[0] + b * Y[0]), Math.round(T[1] + a * X[1] + b * Y[1])];
  /** How far from the pond's centre, 1 on the rim of the round pond inscribed in the footprint. */
  const radius = (a: number, b: number) => Math.hypot((a - 0.5) / 0.5, (b - 0.5) / 0.5);

  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [a, b] = local(x + 0.5, y + 0.5);
      if (a < 0 || a > 1 || b < 0 || b > 1) continue;
      const r = radius(a, b);
      const front = a + b > 1.05; // the near half, where the bank faces you
      if (r > 1.02) c.set(x, y, noise(x, y, 1) < 0.08 ? "G" : noise(x, y, 2) < 0.05 ? "u" : "g");
      else if (r > 0.88) {
        // Rim stones: chunky 3 × 2 blocks, lit on top, shaded where they face you.
        const n = noise(Math.floor(x / 3), Math.floor(y / 2), 3);
        c.set(x, y, n < 0.15 ? "M" : n < 0.3 ? "P" : front && y % 2 === 1 ? "M" : "m");
      } else if (r > 0.82) c.set(x, y, "k"); // the dark line where the stones meet the water
      else if (front && r > 0.7) c.set(x, y, noise(x, y, 4) < 0.5 ? "w" : "W"); // the shallows
    }

  // The moon's reflection, broken into shorter ripples the nearer they come.
  const [mx, my] = at(0.42, 0.42);
  c.disc(mx, my, 3, "p").rect(mx - 1, my - 1, 2, 1, "c");
  for (const [dy, w] of [[5, 7], [7, 5], [9, 3], [11, 2]] as const) c.rect(mx - Math.floor(w / 2), my + dy, w, 1, dy < 8 ? "p" : "P");

  // Lily pads, one in flower.
  const pad = (a: number, b: number, flower: boolean) => {
    const [x, y] = at(a, b);
    c.rect(x - 2, y, 5, 2, "u").set(x, y, "g").set(x + 2, y + 1, "G");
    if (flower) c.set(x, y - 1, "c").set(x - 1, y - 1, "e").set(x + 1, y - 1, "c");
  };
  pad(0.66, 0.3, true);
  pad(0.28, 0.6, false);
  pad(0.7, 0.62, false);

  // Reeds on the far bank, each with its reflection hanging in the water below it.
  for (const [angle, h] of [[195, 10], [212, 13], [228, 8], [250, 11], [300, 9], [316, 12]] as const) {
    const t = (angle * Math.PI) / 180;
    const [x, y] = at(0.5 + 0.47 * Math.cos(t), 0.5 + 0.47 * Math.sin(t));
    // A clump: a tall stalk with a cattail, a shorter one beside it, a blade leaning out.
    c.rect(x, y - h, 1, h, "G").rect(x, y - h + 1, 1, 3, "s").rect(x + 2, y - h + 4, 1, h - 4, "g").set(x - 1, y - 4, "u").set(x - 2, y - 5, "u");
    for (let j = 2; j < Math.round(h * 0.6); j += 2) c.set(x, y + j, "G").set(x + 2, y + j + 1, j < h * 0.4 ? "G" : c.get(x + 2, y + j + 1));
  }
  return c.map();
}

export const place: PlaceDef = {
  id: "compare",
  name: "Mirror pond",
  footprint: { x: -2, y: -1, w: 4, h: 3 },
  doors: [{ x: -1, y: 2 }],
  terrain: "water",
  sprite: mirrorPond(),
};
