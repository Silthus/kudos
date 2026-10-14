import { v, type Infer } from "convex/values";

export const perkValidator = v.union(v.literal("spark"), v.literal("rhythm"), v.literal("circle"), v.literal("flame"), v.literal("cadence"), v.literal("bridge"), v.literal("treasurer"), v.literal("banker"));

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
  { perk: "treasurer", name: "Treasurer", row: 7, skillPoints: 1, coins: 0, upgrades: null, requires: null, copy: "+2 🪙 each time you thank someone and say why, once per person a day." },
  { perk: "banker", name: "Banker", row: 9, skillPoints: 2, coins: 250, upgrades: "treasurer", requires: "treasurer", copy: "Treasurer gives +4 🪙 instead of +2." },
] as const satisfies readonly Perk[];

export type Bonus = ({ xp: number } | { coins: number }) & { on: "the day's first recognition" | "every recognition" | "the week's first recognition of the recipient"; why: string; replaces?: PerkId };

export const bonuses = {
  spark: { xp: 5, on: "the day's first recognition", why: "your first kudos of the day that said why" },
  rhythm: { xp: 2, on: "every recognition", why: "saying why to each person, once a day" },
  circle: { xp: 5, on: "the week's first recognition of the recipient", why: "your first kudos of the week that said why, to each person" },
  flame: { xp: 8, on: "the day's first recognition", why: "your first kudos of the day that said why", replaces: "spark" },
  cadence: { xp: 3, on: "every recognition", why: "saying why to each person, once a day", replaces: "rhythm" },
  bridge: { xp: 8, on: "the week's first recognition of the recipient", why: "your first kudos of the week that said why, to each person", replaces: "circle" },
  treasurer: { coins: 2, on: "every recognition", why: "saying why to each person, once a day" },
  banker: { coins: 4, on: "every recognition", why: "saying why to each person, once a day", replaces: "treasurer" },
} as const satisfies Record<PerkId, Bonus>;

export function perkOf(perk: PerkId): Perk {
  return tree.find((entry) => entry.perk === perk)!;
}

const perksPayingCoins = (Object.keys(bonuses) as PerkId[]).filter((perk) => "coins" in bonuses[perk]);

export function isCoinPerk({ perk, coins }: Pick<Perk, "perk" | "coins">): boolean {
  return hasCoinPrice({ coins }) || paysCoins(perk);
}

export function paysCoins(perk: PerkId): boolean {
  return perksPayingCoins.includes(perk);
}

export function hasCoinPrice({ coins }: Pick<Perk, "coins">): boolean {
  return coins > 0;
}
