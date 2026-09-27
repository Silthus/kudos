import { canStartExpedition, PARTY, tierForLevel, type JoinBlock, type RuinTier } from "./rpg";

/**
 * How the ruins' tiers and gates are said (#163), in one place for the server's refusals and the
 * windows that show them before the server is asked. The numbers come from the rules (`lib/rpg.ts`).
 */

export const TIER_WORD: Record<RuinTier, "near" | "far" | "deep"> = { 1: "near", 2: "far", 3: "deep" };

/** The level a tier opens at, as `tierForLevel` has it: near 6, far 10, deep 15. */
export function tierLevel(tier: RuinTier): number {
  for (let level = 1; level <= 25; level++) if (tierForLevel(level) >= tier) return level;
  return 25;
}

const NO_STAMINA = "You have no stamina left. Every thoughtful kudos you give restores one, and so does a moon fruit.";

/** Why someone can't go into a ruin or with a party, in words: to the viewer about themselves (`you`), or about a teammate. */
export function refusal(reason: JoinBlock | "busy", tier: RuinTier, who: { name: string; level: number; you?: boolean }): string {
  const word = TIER_WORD[tier];
  if (who.you && reason === "level") return `The ${word} ruins open to explorers at level ${tierLevel(tier)}. You're level ${who.level}.`;
  if (who.you && reason === "stamina") return NO_STAMINA;
  if (who.you && reason === "too_far") return "You're too far from the entrance: walk back to it to join.";
  if (who.you && reason === "busy") return "You're on an expedition already. Finish it, or return to camp first.";
  switch (reason) {
    case "level":
      return `${who.name} is level ${who.level}: the ${word} ruins open at level ${tierLevel(tier)}.`;
    case "stamina":
      return `${who.name} has no stamina left: a thoughtful kudos restores one.`;
    case "too_far":
      return `${who.name} is too far from the entrance: invite players within ${PARTY.inviteRadius} tiles of it.`;
    case "full":
      return `The party is full: ${PARTY.max} at most.`;
    case "busy":
      return `${who.name} is on another expedition.`;
  }
}

/** Why the viewer can't lead a run into a ruin of `tier` now, or null when they can. */
export function startBlock(who: { level: number; stamina: number }, tier: RuinTier): string | null {
  const can = canStartExpedition(who, tier);
  return can.ok ? null : refusal(can.reason, tier, { name: "", level: who.level, you: true });
}
