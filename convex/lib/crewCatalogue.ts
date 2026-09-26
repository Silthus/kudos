/**
 * Crew quests (#152 §S6): the catalogue of parts a company can add to its Ancient Tree by pooling
 * Hog coins. A part is proposed, funded by contributions, built three days later, and stays
 * forever with the contributors' names on a plaque. Structures and the statue are built once;
 * styles, the canopy colour and the banner can be proposed again to change them. The parts a
 * workspace chose, together with its seed, are what make its tree unlike any other company's.
 */
import { DISTRICTS, stageIndex, type DistrictId, type TreeStageId } from "./tree";

export const CREW = {
  /** Open proposals a workspace may have at once. */
  maxOpen: 2,
  /** Anyone from this level may propose (or admins only, by setting). */
  proposeLevel: 8,
  buildDays: 3,
  minCost: 200,
  maxCost: 5000,
} as const;

export const DISTRICT_STYLES = ["mossy", "lantern", "blossom", "crystal"] as const;
export type DistrictStyle = (typeof DISTRICT_STYLES)[number];
export const CANOPY_COLOURS = ["amber", "rose", "sap green", "moon blue"] as const;
export const STATUES = ["gardener", "reader", "party", "explorer"] as const;

const STRUCTURES = [
  { kind: "structure", id: "structure_lantern_bridge", district: "signpost", name: "Lantern bridge", about: "A rope bridge strung with lanterns between the first two branches.", cost: 400, stage: "great" },
  { kind: "structure", id: "structure_windmill", district: "terrace", name: "Windmill", about: "A small windmill on the terraces; its sails turn when someone gives kudos.", cost: 600, stage: "great" },
  { kind: "structure", id: "structure_bell", district: "base_camp", name: "The bell", about: "A bell at base camp that rings for every stage the tree reaches.", cost: 300, stage: "great" },
  { kind: "structure", id: "structure_market_awnings", district: "stall", name: "Market awnings", about: "Striped awnings and bunting over the stall.", cost: 500, stage: "great" },
  { kind: "structure", id: "structure_oasis_garden", district: "pool", name: "Oasis garden", about: "Reeds, lilies and a heron around the mirror pool.", cost: 800, stage: "ancient" },
  { kind: "structure", id: "structure_stargazer_deck", district: "observatory", name: "Stargazer deck", about: "A deck above the observatory, open at night.", cost: 1200, stage: "ancient" },
  { kind: "structure", id: "structure_root_stair", district: "near_ruins", name: "Root stair", about: "A stair carved into the roots, down to the ruins.", cost: 2000, stage: "elder" },
] as const;

/** Every district that has a place, or homes, can be dressed in one of four styles. */
const STYLED: DistrictId[] = DISTRICTS.filter((d) => d.places.length > 0 || d.id === "homes").map((d) => d.id);
type StyleId = `style_${DistrictId}`;
const STYLES = STYLED.map((id) => {
  const d = DISTRICTS.find((x) => x.id === id)!;
  return {
    kind: "district_style" as const,
    id: `style_${id}` as StyleId,
    district: id,
    options: DISTRICT_STYLES,
    name: `${d.name} style`,
    about: `How ${d.name.toLowerCase()} is dressed.`,
    cost: id === "homes" ? 900 : id === "base_camp" ? 250 : 350,
    stage: (id === "homes" ? "ancient" : "great") as TreeStageId,
  };
});

const SINGLES = [
  { kind: "canopy_colour", id: "canopy_colour", options: CANOPY_COLOURS, name: "Canopy colour", about: "The colour the canopy turns at dusk.", cost: 1500, stage: "ancient" },
  { kind: "banner", id: "banner", name: "Banner", about: "A banner across the trunk with a saying the crew chooses.", cost: 200, stage: "great" },
  { kind: "statue", id: "statue", district: "base_camp", options: STATUES, name: "Statue", about: "A statue of a hoggie at the tree's foot.", cost: 5000, stage: "elder" },
] as const;

export type CrewPart = (typeof STRUCTURES)[number] | (typeof STYLES)[number] | (typeof SINGLES)[number];
export type CrewPartKind = CrewPart["kind"];
export type CrewPartId = (typeof STRUCTURES)[number]["id"] | StyleId | (typeof SINGLES)[number]["id"];

export const CREW_PARTS: readonly CrewPart[] = [...STRUCTURES, ...STYLES, ...SINGLES];

/** Kinds that are built once; the others can be proposed again to change them. */
const BUILT_ONCE: CrewPartKind[] = ["structure", "statue"];

export function crewPart(id: string): CrewPart | null {
  return CREW_PARTS.find((p) => p.id === id) ?? null;
}

/** The parts a tree at `stage` may have proposed, less the once-only parts it already has or is funding. */
export function partsAvailable(stage: TreeStageId, taken: readonly string[] = []): CrewPart[] {
  return CREW_PARTS.filter((p) => stageIndex(p.stage) <= stageIndex(stage) && !(BUILT_ONCE.includes(p.kind) && taken.includes(p.id)));
}

/** Whether `option` is one the part offers; parts without options take none. */
export function validOption(part: CrewPart, option: string | undefined): boolean {
  if (!("options" in part)) return option === undefined;
  return option !== undefined && (part.options as readonly string[]).includes(option);
}

export const BANNER_TEXT = { max: 60 } as const;

/** One short line of plain text, trimmed, or null: no markup, no control characters or line breaks. */
export function bannerText(text: string): string | null {
  const t = text.trim();
  const control = [...t].some((ch) => {
    const c = ch.charCodeAt(0);
    return c < 0x20 || c === 0x7f || c === 0x2028 || c === 0x2029;
  });
  return t.length > 0 && t.length <= BANNER_TEXT.max && !control && !/[<>]/.test(t) ? t : null;
}
