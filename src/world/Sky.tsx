/**
 * The sky behind the world (#134): plain dusk on an ordinary day; golden hour on a bonus day or
 * while a company-wide booster is on; blight-tinged while a blight is at the tree (#164), which wins
 * over golden hour. Each is hard bands stepping down to the horizon, never a gradient (#126 "no
 * gradients as backgrounds"), and it doesn't move.
 */

/** Bands from the top of the screen down: a colour and how much of the height it takes (%). */
export type Band = { color: string; height: number };

export const DUSK: Band[] = [{ color: "#241e33", height: 100 }];

/** Plum overhead, warming band by band to an ember glow at the horizon, then the dusk ground. */
export const GOLDEN: Band[] = [
  { color: "#2e2138", height: 12 },
  { color: "#3d2439", height: 9 },
  { color: "#522938", height: 8 },
  { color: "#6b3034", height: 7 },
  { color: "#86392d", height: 6 },
  { color: "#a24a26", height: 4 },
  { color: "#3a2436", height: 54 },
];

/** A sickly sky: the plum overhead turns grey-violet, and a purple-grey band of blight hangs over the horizon. */
export const BLIGHTED: Band[] = [
  { color: "#2a2233", height: 14 },
  { color: "#33283d", height: 10 },
  { color: "#3f2f48", height: 8 },
  { color: "#4b3855", height: 6 },
  { color: "#5a4163", height: 6 },
  { color: "#2c2233", height: 56 },
];

export type SkyMood = "dusk" | "golden" | "blight";

export function skyBands(mood: SkyMood): Band[] {
  return mood === "blight" ? BLIGHTED : mood === "golden" ? GOLDEN : DUSK;
}

/**
 * The blight's haze over the world while one is at the tree (#164): the sky's purple-grey reaching
 * down over the top of the scene in three hard, see-through bands, so it shows wherever you stand.
 */
export const HAZE: Band[] = [
  { color: "rgba(90, 65, 99, 0.62)", height: 8 },
  { color: "rgba(90, 65, 99, 0.4)", height: 6 },
  { color: "rgba(90, 65, 99, 0.2)", height: 6 },
];

export function BlightHaze() {
  return (
    <div aria-hidden data-blight-haze className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      {HAZE.map((b, i) => (
        <div key={i} className="w-full shrink-0" style={{ height: `${b.height}%`, backgroundColor: b.color }} />
      ))}
    </div>
  );
}

export function Sky({ mood }: { mood: SkyMood }) {
  const bands = skyBands(mood);
  return (
    <div aria-hidden data-sky={mood} className="pointer-events-none absolute inset-0 flex flex-col">
      {bands.map((b, i) => (
        <div key={i} className="w-full shrink-0" style={{ height: `${b.height}%`, backgroundColor: b.color }} />
      ))}
    </div>
  );
}
