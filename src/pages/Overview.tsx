import { useQuery } from "convex/react";
import clsx from "clsx";
import { useMemo } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { DISTRICT_BY_ID, TREE_STAGE_BY_ID, type DistrictId, type RuinTier, type TreeStageId } from "../../convex/lib/tree";
import { PageSkeleton } from "@/components/ui";
import { navItems } from "@/lib/nav";
import { useViewer } from "@/lib/viewer";
import { PixelArt } from "@/world/PixelArt";
import { pixelRuns, type PixelMap } from "@/world/pixels";
import { ruinPath } from "@/world/places/ruins";
import { districtGlyph, MAP_SIZE, onMap, overviewGround, RINGS, ringPixels, ruinMarker, treeFromAbove } from "@/world/overview";
import { PALETTE } from "@/world/pixels";

/**
 * The overview's window (#163, plan #152 S1; `api.tree.overview`, open from the elder stage): the
 * whole tree and its desert from above as a pixel map: the tree at the centre, the rings of homes
 * and ruins, every district as an icon (lit when open), every ruin as a marker (lit once you've
 * cleared it). Under it, what the map says in words, and a way to walk to each open district.
 */

type Overview = NonNullable<ReturnType<typeof useOverview>>;
const useOverview = () => useQuery(api.tree.overview);

/** Base camp's icon in the list: the tree, as young as it gets. */
const TREE_ICON = treeFromAbove(0);
const TIER_TILES: Record<RuinTier, DistrictId> = { 1: "near_ruins", 2: "far_ruins", 3: "deep_ruins" };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

/** A small pixel map drawn into the overview's SVG at (x, y), centred there. */
function Sprite({ map, x, y, ...rest }: { map: PixelMap; x: number; y: number } & Record<`data-${string}`, string>) {
  const runs = useMemo(() => pixelRuns(map), [map]);
  const w = map.rows[0]?.length ?? 0;
  const h = map.rows.length;
  return (
    <g transform={`translate(${Math.round(x - w / 2)} ${Math.round(y - h / 2)})`} {...rest}>
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </g>
  );
}

function Map({ map, seed }: { map: Overview; seed: number }) {
  const ground = useMemo(() => overviewGround(seed), [seed]);
  const runs = useMemo(() => pixelRuns(ground), [ground]);
  const crown = useMemo(() => treeFromAbove(TREE_STAGE_BY_ID[map.stage as TreeStageId].index), [map.stage]);
  const c = onMap(map.tree);
  return (
    <svg
      data-overview-map
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`The tree from above: ${map.districts.filter((d) => d.open).length} districts open, ${map.ruins.filter((r) => r.explored).length} of ${map.ruins.length} ruins explored`}
      className="mx-auto block w-full max-w-[34rem] border-2 border-bark shadow-[3px_3px_0_0_var(--color-dusk-deep)]"
    >
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
      {RINGS.map((r) => (
        <g key={r.id} data-map-ring={r.id} fill={PALETTE[r.colour]}>
          {ringPixels(r.tiles).map((p) => (
            <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={1} height={1} />
          ))}
        </g>
      ))}
      <g>
        <title>The Ancient Tree</title>
        <Sprite map={crown} x={c.x} y={c.y} data-map-tree="" />
      </g>
      {map.ruins.map((r) => {
        const at = onMap(r.at);
        return (
          <g key={r.id}>
            <title>{`${r.name}${r.explored ? ", explored" : ""}`}</title>
            <Sprite map={ruinMarker(r.tier as RuinTier, r.explored)} x={at.x} y={at.y} data-map-ruin={r.id} data-explored={String(r.explored)} />
          </g>
        );
      })}
      {map.districts.map((d) => {
        const glyph = districtGlyph(d.id);
        if (!glyph) return null;
        const at = onMap(d.at);
        return (
          <g key={d.id} opacity={d.open ? 1 : 0.35}>
            <title>{d.open ? d.name : `${d.name}: opens when the tree is ${d.opensAt}`}</title>
            <Sprite map={glyph} x={at.x} y={at.y} data-map-district={d.id} data-open={String(d.open)} />
          </g>
        );
      })}
    </svg>
  );
}

export function Overview() {
  const map = useOverview();
  const tree = useQuery(api.tree.state);
  const viewer = useViewer();
  if (map === undefined) return <PageSkeleton />;
  if (map === null) return <p className="text-ink">The overview opens when the tree is {TREE_STAGE_BY_ID.elder.name}.</p>;
  // The pages this viewer has: a district's "Walk there" goes to its first place they can open.
  const pages = new Set(
    navItems({
      isAdmin: viewer.member.isAdmin,
      isDemo: viewer.workspace.isDemo,
      storeEnabled: viewer.workspace.storeEnabled || viewer.workspace.gameEnabled === true,
      questsEnabled: viewer.workspace.questsEnabled,
      gameShown: true,
      openRequests: 0,
    }).map((i) => i.id),
  );
  const walkTo = (id: string): string | null => {
    if (id === "overview") return null;
    if (id === "base_camp") return "/offering";
    const tier = (Object.entries(TIER_TILES).find(([, d]) => d === id)?.[0] ?? null) as `${RuinTier}` | null;
    if (tier) {
      const ruin = map.ruins.find((r) => r.tier === Number(tier));
      return ruin ? ruinPath(ruin.id) : null;
    }
    const place = DISTRICT_BY_ID[id as DistrictId]?.places.find((p) => pages.has(p));
    return place ? `/${place}` : null;
  };
  const explored = map.ruins.filter((r) => r.explored).length;
  const next = map.next.stage === "ring" ? "its next ring" : TREE_STAGE_BY_ID[map.next.stage as TreeStageId].name;
  return (
    <div className="space-y-4">
      <Map map={map} seed={tree?.worldSeed ?? 0} />
      <div className="space-y-1 text-sm text-ink">
        <p>
          <span className="font-display text-lg font-medium">{capital(map.stageName)}</span>
          {map.rings > 0 && `, ${count(map.rings, "ring")}`}. {count(map.growth, "point")} of growth; {map.next.growth.toLocaleString("en")} more to {next}.
        </p>
        <p>
          {count(map.homes, "home")} on {count(map.plots, "plot")} of the ring. {explored} of {count(map.ruins.length, "ruin")} explored by you.
        </p>
        <p>{map.blight === null ? "No blight on the tree." : null}</p>
      </div>
      <div aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/75">
        <span className="flex items-center gap-1.5">
          <PixelArt map={ruinMarker(1, true)} width={15} height={15} />
          A ruin you've explored
        </span>
        <span className="flex items-center gap-1.5">
          <PixelArt map={ruinMarker(1, false)} width={15} height={15} />
          Not yet
        </span>
        <span>Dim: a district the tree hasn't opened</span>
      </div>
      <section aria-labelledby="districts">
        <h3 id="districts" className="font-display text-lg font-medium text-ink">
          Districts
        </h3>
        <ul className="mt-1 grid grid-cols-1 gap-x-4 @md:grid-cols-2">
          {map.districts.map((d) => {
            const to = d.open ? walkTo(d.id) : null;
            // Base camp is the tree itself.
            const glyph = districtGlyph(d.id) ?? TREE_ICON;
            return (
              <li key={d.id} data-district-row={d.id} className={clsx("flex min-h-10 items-center gap-2 border-b-2 border-bark/15 py-1 text-sm", d.open ? "text-ink" : "text-ink/60")}>
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center">
                  <PixelArt map={glyph} width={21} height={21} className={clsx(!d.open && "opacity-40")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{d.name}</span>
                  {!d.open && <span className="block text-xs">Opens when the tree is {d.opensAt}</span>}
                </span>
                {to && (
                  <Link to={to} className="shrink-0 font-semibold text-ember-deep underline decoration-2 underline-offset-4">
                    Walk there
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
