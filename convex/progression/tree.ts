import { v, type Infer } from "convex/values";

export const perkValidator = v.union(v.literal("spark"), v.literal("rhythm"), v.literal("circle"), v.literal("flame"), v.literal("cadence"), v.literal("bridge"));

export type PerkId = Infer<typeof perkValidator>;

export type Perk = { perk: PerkId; name: string; row: number; skillPoints: number; coins: number; upgrades: PerkId | null; requires: PerkId | null; copy: string; retired?: boolean };

export const tree = [
  { perk: "spark", name: "Spark", row: 5, skillPoints: 1, coins: 0, upgrades: null, requires: null, copy: "+5 XP the first time each day you thank someone and say why." },
  { perk: "rhythm", name: "Rhythm", row: 5, skillPoints: 1, coins: 0, upgrades: null, requires: null, copy: "+2 XP each time you thank someone and say why, once per person a day." },
  { perk: "circle", name: "Circle", row: 5, skillPoints: 1, coins: 0, upgrades: null, requires: null, copy: "+5 XP the first time each week you thank a person and say why." },
  { perk: "flame", name: "Flame", row: 7, skillPoints: 1, coins: 150, upgrades: "spark", requires: "spark", copy: "Spark gives +8 XP instead of +5." },
  { perk: "cadence", name: "Cadence", row: 7, skillPoints: 1, coins: 200, upgrades: "rhythm", requires: "rhythm", copy: "Rhythm gives +3 XP instead of +2." },
  {
    perk: "bridge",
    name: "Bridge",
    row: 7,
    skillPoints: 1,
    coins: 150,
    upgrades: "circle",
    requires: "circle",
    copy: "Circle gives +8 XP instead of +5 when the person isn't in your primary group. Without a primary group, everyone counts.",
  },
] as const satisfies readonly Perk[];

export type Bonus = { xp: number; on: "the day's first recognition" | "every recognition" | "the week's first recognition of the recipient"; replaces?: PerkId };

export const bonuses = {
  spark: { xp: 5, on: "the day's first recognition" },
  rhythm: { xp: 2, on: "every recognition" },
  circle: { xp: 5, on: "the week's first recognition of the recipient" },
  flame: { xp: 8, on: "the day's first recognition", replaces: "spark" },
  cadence: { xp: 3, on: "every recognition", replaces: "rhythm" },
  bridge: { xp: 8, on: "the week's first recognition of the recipient", replaces: "circle" },
} as const satisfies Record<PerkId, Bonus>;

export function perkOf(perk: PerkId): Perk {
  return tree.find((entry) => entry.perk === perk)!;
}

export function isCoinPerk({ coins }: Pick<Perk, "coins">): boolean {
  return coins > 0;
}
