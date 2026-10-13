// Variant E perks: one tree of seven chains that make kudos worth more XP or coins, or give more kudos, with level-gated rows from 5, one skill point per level from 5, and a mock purchase history so the numbers add up at any preview level.
import { me } from "../../data/mock";
import type { PerkState } from "../../data/types";

export type TreePerk = {
  id: string;
  name: string;
  level: number;
  column: number;
  skillPoints: number;
  coins?: number;
  requires?: string;
  summary: string;
  effect: string;
  switchable?: boolean;
};

export const treeColumns = 4;

export const perks: TreePerk[] = [
  { id: "spark", name: "Spark", level: 5, column: 0, skillPoints: 1, summary: "+5 XP on your first kudos each day", effect: "+5 XP on your first kudos each day" },
  { id: "rhythm", name: "Rhythm", level: 5, column: 1, skillPoints: 1, summary: "+2 XP on every thoughtful kudos you give", effect: "+2 XP on every thoughtful kudos you give" },
  { id: "circle", name: "Circle", level: 5, column: 2, skillPoints: 1, summary: "+5 XP on your first kudos to each person in a week", effect: "+5 XP on your first kudos to each person in a week" },
  { id: "flame", name: "Flame", level: 7, column: 0, skillPoints: 1, coins: 150, requires: "spark", summary: "Spark becomes +10 XP", effect: "+10 XP on your first kudos each day" },
  { id: "cadence", name: "Cadence", level: 7, column: 1, skillPoints: 1, coins: 200, requires: "rhythm", summary: "Rhythm becomes +4 XP", effect: "+4 XP on every thoughtful kudos you give" },
  { id: "bridge", name: "Bridge", level: 7, column: 2, skillPoints: 1, coins: 150, requires: "circle", summary: "Circle becomes +10 XP outside your group", effect: "+5 XP on your first kudos to each person in a week, +10 XP when they're outside your group" },
  { id: "treasurer", name: "Treasurer", level: 7, column: 3, skillPoints: 1, summary: "+2 coins on each thoughtful kudos you give", effect: "+2 coins on each thoughtful kudos you give" },
  { id: "focus", name: "Focus", level: 9, column: 0, skillPoints: 2, switchable: true, summary: "Switch on one day a week for +12 XP on three kudos", effect: "Switch on one day a week: +12 XP on that day's next three kudos" },
  { id: "echo", name: "Echo", level: 9, column: 1, skillPoints: 2, summary: "+3 XP on the first thoughtful kudos from each giver in a week", effect: "+3 XP on the first thoughtful kudos you get from each giver in a week" },
  { id: "reserve", name: "Reserve", level: 9, column: 2, skillPoints: 2, summary: "+2 bonus kudos in your weekly reserve", effect: "+2 bonus kudos in your weekly reserve" },
  { id: "banker", name: "Banker", level: 9, column: 3, skillPoints: 2, coins: 250, requires: "treasurer", summary: "Treasurer becomes +4 coins", effect: "+4 coins on each thoughtful kudos you give" },
  { id: "spotlight", name: "Spotlight", level: 12, column: 0, skillPoints: 2, coins: 300, requires: "focus", summary: "Focus becomes +24 XP", effect: "Switch on one day a week: +24 XP on that day's next three kudos" },
  { id: "resonance", name: "Resonance", level: 12, column: 1, skillPoints: 2, coins: 300, requires: "echo", summary: "Echo becomes +8 XP", effect: "+8 XP on the first thoughtful kudos you get from each giver in a week" },
  { id: "reservoir", name: "Reservoir", level: 12, column: 2, skillPoints: 2, coins: 350, requires: "reserve", summary: "Reserve becomes +4 bonus kudos", effect: "+4 bonus kudos in your weekly reserve" },
];

export const treeLevels = [...new Set(perks.map((p) => p.level))].sort((a, b) => a - b);

export const rowOf = (perk: TreePerk) => treeLevels.indexOf(perk.level);

export const perkById = (id?: string) => perks.find((p) => p.id === id);

export const baseOf = (perk: TreePerk) => perkById(perk.requires);

export const upgradeOf = (perk: TreePerk) => perks.find((p) => p.requires === perk.id);

const firstPointLevel = 5;

const purchases = [
  { perk: "spark", atLevel: 6 },
  { perk: "flame", atLevel: 8 },
];

export const pointsEarnedAt = (level: number) => Math.max(0, level - firstPointLevel + 1);

export const ownedAt = (level: number) => new Set(purchases.filter((p) => p.atLevel <= level).map((p) => p.perk));

export const pointsSpentOn = (owned: Iterable<string>) => [...owned].reduce((sum, id) => sum + (perkById(id)?.skillPoints ?? 0), 0);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const pointsText = (n: number) => plural(n, "skill point");

export function costText(perk: TreePerk) {
  return [pointsText(perk.skillPoints), perk.coins ? `${perk.coins} coins` : undefined].filter(Boolean).join(" + ");
}

export function stateOfPerk(perk: TreePerk, level: number, owned: Set<string>): PerkState {
  if (owned.has(perk.id)) return { kind: "owned" };
  if (level < perk.level) return { kind: "needs-level", level: perk.level };
  const base = baseOf(perk);
  if (base && !owned.has(base.id)) return { kind: "needs-perk", perk: base.name };
  const pointsShort = perk.skillPoints - (pointsEarnedAt(level) - pointsSpentOn(owned));
  if (pointsShort > 0) return { kind: "cant-afford", missing: pointsText(pointsShort) };
  const coinsShort = (perk.coins ?? 0) - me.coins;
  if (coinsShort > 0) return { kind: "cant-afford", missing: `${coinsShort} coins` };
  return { kind: "available" };
}
