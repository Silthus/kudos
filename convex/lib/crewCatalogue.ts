/**
 * Crew quests (#152 §S6): the catalogue of parts a company can add to its Ancient Tree by pooling
 * Hog coins. A part is proposed, funded by contributions, built three days later, and stays
 * forever with the contributors' names on a plaque. The parts a workspace chose, together with
 * its seed, are what make its tree unlike any other company's.
 */
import { stageIndex, type DistrictId, type StageId } from "./tree";

export type CrewPartKind = "structure" | "district_style" | "canopy_colour" | "banner" | "statue";

export type CrewPart = {
  id: string;
  kind: CrewPartKind;
  name: string;
  about: string;
  cost: number;
  /** The tree stage it needs. */
  stage: StageId;
  /** Where it shows; structures and styles belong to a district, the rest to the tree itself. */
  district?: DistrictId;
  /** Style choices the proposer picks one of (district styles have four). */
  options?: string[];
};

const DISTRICT_STYLES = ["mossy", "lantern", "blossom", "crystal"];

export const CREW_PARTS: CrewPart[] = [
  { id: "lantern_bridge", kind: "structure", name: "Lantern bridge", about: "A rope bridge strung with lanterns between the first two branches.", cost: 400, stage: "great", district: "signpost" },
  { id: "windmill", kind: "structure", name: "Windmill", about: "A small windmill on the terraces; its sails turn when someone gives kudos.", cost: 600, stage: "great", district: "terrace" },
  { id: "bell", kind: "structure", name: "The bell", about: "A bell at base camp that rings for every stage the tree reaches.", cost: 300, stage: "great", district: "base_camp" },
  { id: "oasis_garden", kind: "structure", name: "Oasis garden", about: "Reeds, lilies and a heron around the mirror pool.", cost: 800, stage: "ancient", district: "pool" },
  { id: "stargazer_deck", kind: "structure", name: "Stargazer deck", about: "A deck above the observatory, open at night.", cost: 1200, stage: "ancient", district: "observatory" },
  { id: "market_awnings", kind: "structure", name: "Market awnings", about: "Striped awnings and bunting over the stall.", cost: 500, stage: "great", district: "stall" },
  { id: "root_stair", kind: "structure", name: "Root stair", about: "A stair carved into the roots, down to the ruins.", cost: 2000, stage: "elder", district: "near_ruins" },
  { id: "style_base_camp", kind: "district_style", name: "Base camp style", about: "How base camp is dressed.", cost: 250, stage: "great", district: "base_camp", options: DISTRICT_STYLES },
  { id: "style_terrace", kind: "district_style", name: "Terraces style", about: "How the terraces are dressed.", cost: 350, stage: "great", district: "terrace", options: DISTRICT_STYLES },
  { id: "style_homes", kind: "district_style", name: "Homes style", about: "How the homes ring is dressed.", cost: 900, stage: "ancient", district: "homes", options: DISTRICT_STYLES },
  { id: "canopy_colour", kind: "canopy_colour", name: "Canopy colour", about: "The colour the canopy turns at dusk.", cost: 1500, stage: "ancient", options: ["amber", "rose", "sap green", "moon blue"] },
  { id: "banner", kind: "banner", name: "Banner", about: "A banner across the trunk with a saying the crew chooses.", cost: 200, stage: "great" },
  { id: "statue", kind: "statue", name: "Statue", about: "A statue of a hoggie at the tree's foot.", cost: 5000, stage: "elder", district: "base_camp", options: ["gardener", "reader", "party", "explorer"] },
];

export function crewPart(id: string): CrewPart | null {
  return CREW_PARTS.find((p) => p.id === id) ?? null;
}

/** The parts a tree at `stage` may have proposed. */
export function partsAvailable(stage: StageId): CrewPart[] {
  return CREW_PARTS.filter((p) => stageIndex(p.stage) <= stageIndex(stage));
}

export const BANNER_TEXT = { max: 60 } as const;

/** One short line of plain text: no markup, no line breaks. */
export function validBannerText(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= BANNER_TEXT.max && !/[<>\n\r]/.test(t);
}
