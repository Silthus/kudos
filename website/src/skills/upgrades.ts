import type { PerkNode, TreeRow } from "../shell";

export type Chain = { base: PerkNode | undefined; upgrade: PerkNode | undefined };

export type NodeKind = PerkNode["state"] | "upgraded";

export type PlacedPerk = { perk: PerkNode; column: number };

export type PlacedRow = { level: number; perks: PlacedPerk[] };

export type TreeLayout = { columns: number; rows: PlacedRow[] };

export function chainOf(perk: PerkNode, rows: TreeRow[]): Chain {
  const perks = rows.flatMap((row) => row.perks);
  return { base: perks.find((each) => each.perk === perk.upgrades), upgrade: perks.find((each) => each.upgrades === perk.perk) };
}

export function upgradedTo(perk: PerkNode, { upgrade }: Chain): PerkNode | undefined {
  return perk.state === "owned" && upgrade?.state === "owned" ? upgrade : undefined;
}

export function upgradedFrom(perk: PerkNode, { base }: Chain): PerkNode | undefined {
  return perk.state === "owned" && base?.state === "owned" ? base : undefined;
}

export function kindOf(perk: PerkNode, chain: Chain): NodeKind {
  return upgradedTo(perk, chain) === undefined ? perk.state : "upgraded";
}

export function hasUpgrades(rows: TreeRow[]): boolean {
  return rows.some(({ perks }) => perks.some(({ upgrades }) => upgrades !== null));
}

export function layoutOf(rows: TreeRow[]): TreeLayout {
  const columns = new Map<PerkNode["perk"], number>();
  const placed = rows.map(({ level, perks }) => ({ level, perks: placeRow(perks, columns) }));
  return { columns: Math.max(1, ...placed.flatMap(({ perks }) => perks.map(({ column }) => column + 1))), rows: placed };
}

function placeRow(perks: PerkNode[], columns: Map<PerkNode["perk"], number>): PlacedPerk[] {
  const taken = new Set<number>();
  const take = (perk: PerkNode, column: number) => {
    taken.add(column);
    columns.set(perk.perk, column);
  };
  for (const perk of perks) {
    const below = perk.upgrades === null ? undefined : columns.get(perk.upgrades);
    if (below !== undefined && !taken.has(below)) take(perk, below);
  }
  for (const perk of perks.filter((each) => !columns.has(each.perk))) take(perk, firstFree(taken));
  return perks.map((perk) => ({ perk, column: columns.get(perk.perk)! })).sort((a, b) => a.column - b.column);
}

function firstFree(taken: Set<number>) {
  let column = 0;
  while (taken.has(column)) column += 1;
  return column;
}
