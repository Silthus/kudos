/**
 * The sky behind the world (#134): plain dusk on an ordinary day; golden hour on a bonus day or
 * while a company-wide booster is on. Golden hour is hard bands of warm dusk stepping down to the
 * horizon, never a gradient (#126 "no gradients as backgrounds"), and it doesn't move.
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

export function Sky({ golden }: { golden: boolean }) {
  const bands = golden ? GOLDEN : DUSK;
  return (
    <div aria-hidden data-sky={golden ? "golden" : "dusk"} className="pointer-events-none absolute inset-0 flex flex-col">
      {bands.map((b, i) => (
        <div key={i} className="w-full shrink-0" style={{ height: `${b.height}%`, backgroundColor: b.color }} />
      ))}
    </div>
  );
}
