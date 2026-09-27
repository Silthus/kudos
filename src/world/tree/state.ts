import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { DISTRICT_BY_ID, TREE_STAGE_BY_ID, growthToReach, layout, type DistrictId, type Layout, type TreeStageId } from "../../../convex/lib/tree";
import { crewPartTitle } from "../../../convex/lib/treeView";
import { CREW } from "../../../convex/lib/crewCatalogue";
import type { Toast } from "../life";
import type { WorldInput } from "../world";
import { treeCosmetics } from "./cosmetics";

/**
 * What the tree's state (`api.tree.state`, #154) means for the world (#156): the tree the world is
 * built round, the line a closed district says, and the moments of the tree worth a toast: the seed
 * planted while you watch, and districts opening as it grows. Pure; `WorldShell` plays them.
 */

type Full = NonNullable<FunctionReturnType<typeof api.tree.state>>;
/** The parts of `api.tree.state` the world reads; null while the game isn't shown to you. */
export type TreeState = Pick<Full, "planted" | "stage" | "growth" | "peakGrowth" | "plantedBy" | "worldSeed" | "rings"> & {
  layout: Full["layout"] | Layout;
  /** The latest events (the crew's funded and built toasts) and what the crew built (#161). */
  events?: Pick<Full["events"][number], "_id" | "kind" | "part" | "option">[];
  cosmetics?: Full["cosmetics"];
};

export type TreeInput = Pick<WorldInput, "seed" | "layout" | "planted" | "cosmetics">;

/**
 * With the game off or hidden there is no tree to grow, but the pages are still places: they stand
 * round a grown tree (every page's district is open by then), in a fixed desert, and nothing of the
 * game is there to promise: no homes, ruins, crew or blight, no closed outlines.
 */
const RESTING_SEED = 20_260_926;
/** Districts whose only places are the game's own (#160's homes and canopy): not there without the game. */
const GAME_ONLY: DistrictId[] = ["homes", "canopy"];
function resting(): Layout {
  const grown = layout(RESTING_SEED, TREE_STAGE_BY_ID.grown.growth);
  return { ...grown, districts: grown.districts.filter((d) => d.open && DISTRICT_BY_ID[d.id].places.length > 0 && !GAME_ONLY.includes(d.id)), homes: [], ruins: [] };
}

/** The tree the world is built round; null while the state is loading. */
export function treeInput(state: TreeState | null | undefined): TreeInput | null {
  if (state === undefined) return null;
  if (state === null) return { seed: RESTING_SEED, layout: resting(), planted: true, cosmetics: treeCosmetics([]) };
  // The layout is the server's (`lib/tree.ts` `layout`), worked out there so every browser agrees.
  return { seed: state.worldSeed, layout: state.layout as Layout, planted: state.planted, cosmetics: treeCosmetics(state.cosmetics) };
}

/** What a closed district says as you come up to it, from the tree's peak growth (what opens districts). */
export function closedLine(site: { opens: TreeStageId }, peakGrowth: number) {
  return `Opens when the tree is ${TREE_STAGE_BY_ID[site.opens].name}: ${growthToReach(peakGrowth, site.opens)} more thoughtful kudos.`;
}

export type CrewMoment = { kind: "crew_funded" | "crew_built"; part: string; option?: string };
export type TreeMoments = { seeded: boolean; opened: DistrictId[]; crew: CrewMoment[] };

/** The districts open on a tree that this client knows (a newer server may know more). */
const openIds = (s: TreeState) => s.layout.districts.filter((d) => d.open && Object.hasOwn(DISTRICT_BY_ID, d.id)).map((d) => d.id as DistrictId);

/**
 * What happened to the tree between two looks at it while you were here: the seed planted, and the
 * districts that opened. Arriving (no earlier look), the game switching off or on, is no moment.
 */
export function treeMoments(prev: TreeState | null | undefined, next: TreeState | null | undefined): TreeMoments {
  // Another workspace's tree (a workspace switch) is nothing that happened to this one.
  if (!prev || !next || prev.worldSeed !== next.worldSeed) return { seeded: false, opened: [], crew: [] };
  const was = new Set(openIds(prev));
  const seen = new Set((prev.events ?? []).map((e) => e._id));
  const crew = (next.events ?? [])
    .filter((e): e is typeof e & { kind: CrewMoment["kind"]; part: string } => !seen.has(e._id) && (e.kind === "crew_funded" || e.kind === "crew_built") && !!e.part)
    .reverse()
    .map((e) => ({ kind: e.kind, part: e.part, ...(e.option ? { option: e.option } : {}) }));
  return { seeded: !prev.planted && next.planted, opened: openIds(next).filter((id) => !was.has(id)), crew };
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
  for (const c of m.crew)
    toasts.push(
      c.kind === "crew_funded"
        ? { kind: "tree", title: `The crew funded ${crewPartTitle(c.part, c.option)}`, body: `It will be built in ${CREW.buildDays} days, and everyone who gave is on the plaque.` }
        : { kind: "tree", title: `The crew built ${crewPartTitle(c.part, c.option)}`, body: "It stands on the tree now, for good.", link: { to: "/crew", label: "See the plaque" } },
    );
  return toasts;
}
