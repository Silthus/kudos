import type { Rarity } from "./messages";
import { joinNames } from "./messages";

/**
 * Kudos sprees, the pure rules of #55 §G6. A thoughtful kudos the bot confirmed can be *joined*:
 * a join reserves one of the joiner's kudos today per person named and uses one of their monthly
 * spree joins. Joins wait until the next tier (5, 10, 20, 50, 100 distinct joiners) is reached,
 * then go to the receivers as real kudos; each tier opens a fresh 24 h for the next one, and a
 * missed tier lapses the waiting joins (their spree joins come back). The engine is `convex/sprees.ts`.
 */

/** Distinct joiners needed for each tier, in order. There's no tier beyond 100. */
export const TIERS = [5, 10, 20, 50, 100] as const;

/** Each tier (and the kudos itself, for the first) opens this long for the next one. */
export const WINDOW_MS = 24 * 3_600_000;

/** Spree joins everyone gets per workspace month; the Wanderer skill adds 2, the Store more. */
export const MONTHLY_JOINS = 5;
export const WANDERER_JOINS = 2;

/** The receivers' message is rolled at this rarity or rarer, by the tier reached (T1 … T5). */
export const TIER_RARITY: readonly Rarity[] = ["uncommon", "rare", "epic", "epic", "legendary"];

/** What a tier pays while the game is on (§G6); receivers get their receiving XP once per tier. */
export const TIER_REWARDS = {
  paidNow: { xp: 10, coins: 1 },
  earlier: { xp: 5, coins: 1 },
  giver: { xp: 20, coins: 5 },
  receiverXp: 5,
} as const;

/** The number of joiners the tier after `reached` tiers needs, or null after the last one. */
export function nextTier(reached: number): number | null {
  return TIERS[reached] ?? null;
}

export function joinsAllowed({ wanderer, bought }: { wanderer: boolean; bought: number }) {
  return MONTHLY_JOINS + (wanderer ? WANDERER_JOINS : 0) + bought;
}

/** The ephemeral Join / Not now prompt: "Join Ana's kudos for Ben? Uses 1 kudos today + …". */
export function promptText(p: { giver: string; receivers: string[]; unit: string; joinsLeft: number; joiners: number; next: number }) {
  const joins = p.joinsLeft === 1 ? "your last spree join this month" : `1 of your ${p.joinsLeft} spree joins this month`;
  return `Join ${whose(p)}? Uses ${p.receivers.length} ${p.unit} today + ${joins} · ${p.joiners}/${p.next} joined`;
}

export type TierReward<Id extends string = string> = { memberId: Id; role: "joined" | "started" | "received"; xp: number; coins: number };

/** Who a tier pays what: joiners paid out now, everyone who joined earlier, the giver and the receivers. */
export function tierRewards<Id extends string>(p: { paidNow: Id[]; earlier: Id[]; giver: Id; receivers: Id[] }): TierReward<Id>[] {
  const r = TIER_REWARDS;
  return [
    ...p.paidNow.map((memberId) => ({ memberId, role: "joined" as const, ...r.paidNow })),
    ...p.earlier.map((memberId) => ({ memberId, role: "joined" as const, ...r.earlier })),
    { memberId: p.giver, role: "started" as const, ...r.giver },
    ...p.receivers.map((memberId) => ({ memberId, role: "received" as const, xp: r.receiverXp, coins: 0 })),
  ];
}

type Named = { giver: string; receivers: string[] };
const whose = (p: Named) => `${p.giver}'s kudos for ${joinNames(p.receivers)}`;

/** The prompt, after Join: where the spree stands now. */
export function joinedText(p: Named & { joiners: number; next: number | null; reached: number | null }) {
  if (p.reached !== null) return `You joined ${whose(p)} · ${p.joiners} joined: it's a spree of ${p.reached}!`;
  return `You joined ${whose(p)} · ${p.joiners}/${p.next} joined. It pays out when ${p.next} have joined.`;
}

/** After the reaction came off the same day. */
export function leftText(p: Named) {
  return `You left ${whose(p)}. Your kudos and spree join are back.`;
}

/** The public reply in the kudos' thread when a tier is reached (§G13). */
export function tierPostText(p: Named & { reached: number; next: number | null }) {
  const next = p.next === null ? "That's the biggest spree there is." : `Next: ${p.next} within 24 hours.`;
  return `🎉 ${whose(p)} became a spree of ${p.reached}! ${next}`;
}

/** Why someone who may take part can't join right now. */
export type Refusal = { kind: "closed" } | { kind: "joined" } | { kind: "no_joins"; allowed: number } | { kind: "allowance"; needed: number; left: number; unit: string } | { kind: "party" };

export function refusalText(r: Refusal): string {
  switch (r.kind) {
    case "closed":
      return "This spree is over.";
    case "joined":
      return "You're already in this spree.";
    case "no_joins":
      return `You've used all ${r.allowed} of your spree joins this month. They come back on the 1st.`;
    case "allowance":
      return `Joining takes ${r.needed} ${r.unit} from today, and you have ${r.left} left.`;
    case "party":
      return "You can't join a kudos you gave or received.";
  }
}
