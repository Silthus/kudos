import { v, type Infer } from "convex/values";

export const perkValidator = v.union(v.literal("spark"), v.literal("rhythm"), v.literal("circle"));

export type PerkId = Infer<typeof perkValidator>;

export type Perk = { perk: PerkId; name: string; row: number; skillPoints: number; requires: PerkId | null; copy: string };

export const tree = [
  { perk: "spark", name: "Spark", row: 5, skillPoints: 1, requires: null, copy: "+5 XP the first time each day you thank someone and say why." },
  { perk: "rhythm", name: "Rhythm", row: 5, skillPoints: 1, requires: null, copy: "+2 XP each time you thank someone and say why, once per person a day." },
  { perk: "circle", name: "Circle", row: 5, skillPoints: 1, requires: null, copy: "+5 XP the first time each week you thank a person and say why." },
] as const satisfies readonly Perk[];

export function perkOf(perk: PerkId): Perk {
  return tree.find((entry) => entry.perk === perk)!;
}
