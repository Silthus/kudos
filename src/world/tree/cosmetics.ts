import { CANOPY_COLOURS, crewPart, DISTRICT_STYLES, STATUES, type CrewPart, type DistrictStyle } from "../../../convex/lib/crewCatalogue";
import type { DistrictId } from "../../../convex/lib/tree";

/**
 * What the crew built on the tree (#161, `api.tree.state().cosmetics`), as the world draws it: the
 * structures standing by their districts, each district's style, the canopy's colour, the banner's
 * saying across the trunk and the statue at the tree's foot. Pure; a part or option this client
 * doesn't know (a newer server) is left out.
 */

export type BuiltPart = { part: string; option?: string; text?: string };
export type StructureId = Extract<CrewPart, { kind: "structure" }>["id"];
export type CanopyColour = (typeof CANOPY_COLOURS)[number];
export type Statue = (typeof STATUES)[number];

export type TreeCosmetics = {
  structures: { id: StructureId; district: DistrictId }[];
  styles: { district: DistrictId; style: DistrictStyle }[];
  canopy: CanopyColour | null;
  banner: string | null;
  statue: Statue | null;
};

export const NO_COSMETICS: TreeCosmetics = { structures: [], styles: [], canopy: null, banner: null, statue: null };

const known = <T extends string>(list: readonly T[], v: string | undefined): v is T => v !== undefined && (list as readonly string[]).includes(v);

export function treeCosmetics(parts: readonly BuiltPart[] | null | undefined): TreeCosmetics {
  const out: TreeCosmetics = { structures: [], styles: [], canopy: null, banner: null, statue: null };
  for (const b of parts ?? []) {
    const part = crewPart(b.part);
    if (!part) continue;
    if (part.kind === "structure") out.structures.push({ id: part.id, district: part.district });
    else if (part.kind === "district_style" && known(DISTRICT_STYLES, b.option)) out.styles.push({ district: part.district, style: b.option });
    else if (part.kind === "canopy_colour" && known(CANOPY_COLOURS, b.option)) out.canopy = b.option;
    else if (part.kind === "banner" && b.text) out.banner = b.text;
    else if (part.kind === "statue" && known(STATUES, b.option)) out.statue = b.option;
  }
  return out;
}

/** Names what's drawn, so the world repaints when the crew builds something and not otherwise. */
export function cosmeticsKey(c: TreeCosmetics): string {
  return JSON.stringify([c.structures.map((s) => s.id).sort(), c.styles.map((s) => `${s.district}:${s.style}`).sort(), c.canopy, c.banner, c.statue]);
}
