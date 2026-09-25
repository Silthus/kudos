import clsx from "clsx";
import { RemoteArt } from "@/components/RemoteArt";

/** The coin in pixels: a soil rim, a lantern-gold face, a parchment glint and an ember-deep shade. */
const COIN_ROWS = [
  "....ssss....",
  "..ssplllss..",
  ".spplllllEs.",
  ".spllllllEs.",
  "spllllllllEs",
  "slllllllllEs",
  "slllllllllEs",
  "slllllllllEs",
  ".sllllllEEs.",
  ".sllllllEEs.",
  "..sslEEEss..",
  "....ssss....",
];
const FACE_ROWS = ["........", "..s..s..", "..s..s..", "..ssss..", "..s..s..", "..s..s..", "........", "........"];
const COLOURS: Record<string, string> = { s: "#5a3b2a", l: "#f7a501", p: "#efe3c4", E: "#a83800" };

/** One rect per run of a colour in a row: whole pixels on the grid, drawn with crisp edges. */
function runs(rows: string[]) {
  return rows.flatMap((row, y) => {
    const out: { x: number; y: number; w: number; fill: string }[] = [];
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let end = x + 1;
      while (row[end] === ch) end++;
      if (COLOURS[ch]) out.push({ x, y, w: end - x, fill: COLOURS[ch] });
      x = end;
    }
    return out;
  });
}
const COIN = runs(COIN_ROWS);
const FACE = runs(FACE_ROWS);

function Pixels({ rects, size, ...rest }: { rects: typeof COIN; size: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden {...rest}>
      {rects.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/**
 * The Hog coin (#55 §G4, §G17): a gold pixel coin (#126) with Max on its face. The coin is our own;
 * Max is PostHog's, loaded from PostHog's servers (`lib/art.ts`). Until he loads, and if he can't,
 * the coin shows a pixel H instead. Decorative: the amount next to it carries the meaning.
 */
export function HogCoin({ size = 20, className }: { size?: number; className?: string }) {
  // Whole screen pixels per coin pixel (#126): the nearest multiple of the coin's 12 px grid.
  const px = Math.max(12, Math.round(size / 12) * 12);
  return (
    <span data-hog-coin aria-hidden className={clsx("relative inline-block shrink-0 align-middle", className)} style={{ width: px, height: px }}>
      <Pixels data-coin-rim rects={COIN} size={12} className="pixels absolute inset-0 h-full w-full" />
      <RemoteArt
        slot="coin-max"
        className="absolute inset-[16.67%] rounded-full"
        fallback={<Pixels data-coin-face rects={FACE} size={8} className="pixels h-full w-full" />}
      />
    </span>
  );
}
