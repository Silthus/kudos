import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { DISTRICT_BY_ID, TREE_STAGE_BY_ID, layout, type DistrictId, type Layout, type TreeStageId } from "../../../convex/lib/tree";
import type { Toast } from "../life";
import type { WorldInput } from "../world";

/**
 * What the tree's state (`api.tree.state`, #154) means for the world (#156): the tree the world is
 * built round, the line a closed district says, and the moments of the tree worth a toast: the seed
 * planted while you watch, and districts opening as it grows. Pure; `WorldShell` plays them.
 */

type Full = NonNullable<FunctionReturnType<typeof api.tree.state>>;
/** The parts of `api.tree.state` the world reads; null while the game isn't shown to you. */
export type TreeState = Pick<Full, "planted" | "stage" | "growth" | "peakGrowth" | "plantedBy" | "worldSeed" | "rings"> & { layout: Full["layout"] | Layout };

export type TreeInput = Pick<WorldInput, "seed" | "layout" | "peakGrowth" | "planted">;

/**
 * With the game off or hidden there is no tree to grow, but the pages are still places: they stand
 * round a grown tree (every page's district is open by then), in a fixed desert.
 */
const RESTING = { seed: 20_260_926, growth: TREE_STAGE_BY_ID.grown.growth };

/** The tree the world is built round; null while the state is loading. */
export function treeInput(state: TreeState | null | undefined): TreeInput | null {
  if (state === undefined) return null;
  if (state === null) return { seed: RESTING.seed, layout: layout(RESTING.seed, RESTING.growth), peakGrowth: RESTING.growth, planted: true };
  // The layout is the server's (`lib/tree.ts` `layout`), worked out there so every browser agrees.
  return { seed: state.worldSeed, layout: state.layout as Layout, peakGrowth: state.peakGrowth, planted: state.planted };
}

/** What a closed district says as you come up to it. */
export function closedLine(site: { opens: TreeStageId; toOpen: number }) {
  return `Opens when the tree is ${TREE_STAGE_BY_ID[site.opens].name}: ${site.toOpen} more thoughtful kudos.`;
}

export type TreeMoments = { seeded: boolean; opened: DistrictId[] };

const openIds = (s: TreeState) => s.layout.districts.filter((d) => d.open).map((d) => d.id as DistrictId);

/**
 * What happened to the tree between two looks at it while you were here: the seed planted, and the
 * districts that opened. Arriving (no earlier look), the game switching off or on, is no moment.
 */
export function treeMoments(prev: TreeState | null | undefined, next: TreeState | null | undefined): TreeMoments {
  if (!prev || !next) return { seeded: false, opened: [] };
  const was = new Set(openIds(prev));
  return { seeded: !prev.planted && next.planted, opened: openIds(next).filter((id) => !was.has(id)) };
}

/** "The stall, the elder oak and the mirror pool": names in a sentence. */
function listed(ids: DistrictId[]) {
  const names = ids.map((id, i) => (i === 0 ? DISTRICT_BY_ID[id].name : DISTRICT_BY_ID[id].name.replace(/^The /, "the ")));
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The toasts the tree's moments show. */
export function treeToasts(m: TreeMoments, next: TreeState): Toast[] {
  const toasts: Toast[] = [];
  if (m.seeded)
    toasts.push({
      kind: "tree",
      title: "The Ancient Seed is planted",
      body: `${next.plantedBy ?? "Someone"} planted it in the middle of the desert. Every thoughtful kudos from now on makes it grow.`,
    });
  // Base camp opens with the seed itself: that's the seed's moment, not a district's.
  const opened = m.opened.filter((id) => id !== "base_camp");
  if (opened.length)
    toasts.push({
      kind: "tree",
      title: `The tree is now ${TREE_STAGE_BY_ID[next.stage].name}`,
      body: `${listed(opened)} ${opened.length === 1 ? "is" : "are"} open.`,
    });
  return toasts;
}
