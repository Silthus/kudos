// Variant E perk trees: the 21 mock perks regrouped into three themed trees on a four-column grid, no row earlier than the level the tree unlocks.
import { perks } from "../../data/mock";
import type { Perk } from "../../data/types";
import { unlockOf } from "./unlocks";

export type TreeId = "generosity" | "fortune" | "fellowship";

export type Tree = { id: TreeId; name: string; theme: string };

export const trees: Tree[] = [
  { id: "generosity", name: "Generosity", theme: "More XP for every thank-you you give." },
  { id: "fortune", name: "Fortune", theme: "Find more cosmetics and choose your own." },
  { id: "fellowship", name: "Fellowship", theme: "Being thanked, bonus kudos and your group." },
];

export const treeColumns = 4;

type Placement = { tree: TreeId; column: number };

const placements: Record<string, Placement> = {
  spark: { tree: "generosity", column: 0 },
  flame: { tree: "generosity", column: 0 },
  rhythm: { tree: "generosity", column: 1 },
  cadence: { tree: "generosity", column: 1 },
  focus: { tree: "generosity", column: 2 },
  spotlight: { tree: "generosity", column: 2 },
  circle: { tree: "generosity", column: 3 },
  bridge: { tree: "generosity", column: 3 },
  curiosity: { tree: "fortune", column: 0 },
  fortune: { tree: "fortune", column: 0 },
  fieldnotes: { tree: "fortune", column: 1 },
  beacon: { tree: "fortune", column: 1 },
  keepsake: { tree: "fortune", column: 2 },
  signature: { tree: "fortune", column: 3 },
  gallery: { tree: "fortune", column: 3 },
  echo: { tree: "fellowship", column: 0 },
  resonance: { tree: "fellowship", column: 0 },
  reserve: { tree: "fellowship", column: 1 },
  reservoir: { tree: "fellowship", column: 1 },
  rally: { tree: "fellowship", column: 2 },
  provision: { tree: "fellowship", column: 3 },
};

export type PlacedPerk = { perk: Perk; row: number; column: number };

export type TreeLayout = { tree: Tree; levels: number[]; nodes: PlacedPerk[] };

export const treeLevelOf = (perk: Perk) => Math.max(perk.minLevel, unlockOf("skills").level);

export const treeOf = (perk: Perk) => trees.find((t) => t.id === placements[perk.id]?.tree) ?? trees[0];

export function layoutOf(tree: Tree): TreeLayout {
  const members = perks.filter((p) => placements[p.id]?.tree === tree.id);
  const levels = [...new Set(members.map(treeLevelOf))].sort((a, b) => a - b);
  const nodes = members.map((perk) => ({ perk, row: levels.indexOf(treeLevelOf(perk)), column: placements[perk.id].column }));
  return { tree, levels, nodes };
}

export const layouts = trees.map(layoutOf);
