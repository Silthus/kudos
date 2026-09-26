/**
 * Homes on the tree (#152 §S5): a member buys one branch plot on the homes ring and builds a home
 * on it in stages, each paid in Hog coins and taking real days, like a plant. A star fruit takes a
 * quarter off one stage. Homes are state, never replayed, and nothing about them is ever lost.
 */
import { whole } from "./numbers";

export const PLOT_PRICE = 40;

export type HomeStageId = "sky" | "planks" | "leaf_hut" | "timber_house" | "lantern_lodge" | "canopy_manor";

export type HomeStage = { id: HomeStageId; name: string; cost: number; days: number; index: number };

const STAGE_LIST: Omit<HomeStage, "index">[] = [
  { id: "sky", name: "Under the sky", cost: 0, days: 0 },
  { id: "planks", name: "Scarves and planks", cost: 30, days: 2 },
  { id: "leaf_hut", name: "Leaf hut", cost: 60, days: 5 },
  { id: "timber_house", name: "Timber house", cost: 120, days: 10 },
  { id: "lantern_lodge", name: "Lantern lodge", cost: 250, days: 20 },
  { id: "canopy_manor", name: "Canopy manor", cost: 500, days: 40 },
];

export const HOME_STAGES: HomeStage[] = STAGE_LIST.map((s, index) => ({ ...s, index }));
export const HOME_STAGE_BY_ID = Object.fromEntries(HOME_STAGES.map((s) => [s.id, s])) as Record<HomeStageId, HomeStage>;

export function nextHomeStage(current: HomeStageId): HomeStage | null {
  return HOME_STAGES[HOME_STAGE_BY_ID[current].index + 1] ?? null;
}

/** What a stage costs with a star fruit's discount applied (rounded up, so a discount never makes a stage free). */
export function stageCost(stage: HomeStage, discountPercent = 0): number {
  return Math.ceil(stage.cost * (1 - Math.min(100, Math.max(0, whole(discountPercent))) / 100));
}

/** Guestbook lanterns a visitor may leave, per home per week. */
export const LANTERNS_PER_VISITOR_PER_WEEK = 1;
export const GUESTBOOK_MAX = 50;
