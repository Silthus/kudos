// Variant E upgrade chains: local mock facts for one seeded upgrade and each upgrade's effect written in full.
import { perks } from "../../data/mock";
import type { Perk, PerkState } from "../../data/types";

export const seededOwned = new Set(["flame"]);

const fullEffects: Record<string, string> = {
  flame: "+9 XP on the first qualifying recognition of each workday",
  cadence: "A recognition every workday of a week: +16 XP × those workdays",
  spotlight: "Switch on one day a week: +24 XP on that day's next three qualifying recognitions",
  resonance: "+6 XP on the first thoughtful kudos from each giver in your week",
  reservoir: "Weekly reserve +4 bonus kudos",
  fortune: "Drop rates +50% of base",
};

export const effectOf = (perk: Perk) => fullEffects[perk.id] ?? perk.effect;

export const baseOf = (perk: Perk) => perks.find((p) => p.id === perk.requires);

export const upgradeOf = (perk: Perk) => perks.find((p) => p.requires === perk.id);

export const mockStateOf = (perk: Perk): PerkState => (seededOwned.has(perk.id) ? { kind: "owned" } : perk.state);
