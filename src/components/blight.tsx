import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { dayLabel } from "../../convex/lib/boosts";
import { dayKeyFor } from "../../convex/lib/time";
import { useViewer } from "@/lib/viewer";
import { Progress } from "@/components/ui";
import { PixelArt } from "@/world/PixelArt";
import { PixelCanvas, type PixelMap } from "@/world/pixels";

/**
 * The blight's pieces (#164) shared by the stone's window, the HUD and the gallery: its meter and
 * the crest of a blight beaten. Our own pixel heraldry, never PostHog's.
 */

/** The blight's meter: what's left of it, in blight purple. */
export function BlightMeter({ left, hp, height = 14, className }: { left: number; hp: number; height?: number; className?: string }) {
  return <Progress value={left} max={hp} color="var(--color-blight)" height={height} className={className} label={`The blight: ${left} of ${hp} left`} />;
}

/**
 * A blight crest: a heater shield in bark, its field parchment over a band of blight purple, and on
 * it the Ancient Tree in sap green, standing over the blight's broken edge.
 */
export function blightCrest(): PixelMap {
  const c = new PixelCanvas(20, 24);
  // The shield: straight sides, a point at the foot.
  c.polygon([[1, 1], [18, 1], [18, 13], [10, 22], [9, 22], [1, 13]], "b");
  c.polygon([[3, 3], [16, 3], [16, 12], [10, 19], [9, 19], [3, 12]], "p");
  // The beaten blight: a purple band with a ragged, broken top edge.
  c.polygon([[3, 12], [16, 12], [10, 19], [9, 19]], "x");
  c.set(4, 11, "x").set(6, 11, "x").set(7, 10, "x").set(12, 11, "x").set(14, 10, "x").set(15, 11, "x");
  // The tree over it: trunk and a round crown, lit with sap.
  c.rect(9, 8, 2, 6, "B");
  c.polygon([[6, 8], [9, 4], [10, 4], [13, 8], [11, 9], [8, 9]], "g");
  c.set(9, 5, "y").set(8, 7, "y").set(11, 6, "y");
  return c.outline().map();
}

export function BlightCrest({ size = 40, label }: { size?: number; label?: string }) {
  const map = useMemo(blightCrest, []);
  return (
    <span data-crest className="inline-block shrink-0">
      <PixelArt map={map} width={size} height={Math.round((size * 24) / 20)} label={label} />
    </span>
  );
}

/** The gallery's blight crests: one for each blight the viewer helped beat, newest first. */
export function BlightCrests() {
  const crests = useQuery(api.discoveries.crests);
  const { workspace } = useViewer();
  if (!crests) return null;
  return (
    <section id="crests" data-crests aria-labelledby="crests-title" className="space-y-3">
      <div>
        <h2 id="crests-title" className="font-display text-xl font-medium">
          Blight crests
        </h2>
        <p className="text-sm text-ink/75">{crests.length === 0 ? "Help beat a blight at the tree to hang its crest here." : "One for every blight you helped the company beat."}</p>
      </div>
      {crests.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2">
          {crests.map((c) => (
            <li key={c.number} className="flex items-center gap-3 border-2 border-bark bg-parchment p-3 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
              <BlightCrest size={40} label="A blight crest" />
              <div className="min-w-0 text-sm text-ink">
                <p className="font-display text-base">
                  Blight {c.number}, beaten on {dayLabel(dayKeyFor(c.wonAt, workspace.timezone))}
                </p>
                <p className="text-ink/75">You dealt it {c.damage}.</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
