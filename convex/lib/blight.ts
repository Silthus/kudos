/**
 * Blights (#152 §S8): a shared foe that comes to the tree every 2–4 weeks from the ancient stage,
 * which the whole company wears down for five days with thoughtful kudos, cleared expedition rooms
 * and the blight raid at the tree's foot. Victory calls a bonus day; a defeat only dims the
 * lanterns for a week and makes the next blight smaller. Nothing owned is ever lost to a blight.
 */
import { whole } from "./numbers";
import type { Room } from "./rpg";

export const BLIGHT = {
  hpPerActiveMember: 40,
  /** Even a two-person company has something to defend against. */
  minHp: 80,
  /** A member counts as active with a kudos given or received in this many days before the blight. */
  activeDays: 30,
  windowDays: 5,
  /** Scheduled at random between these, in days, after the last one (or the ancient stage). */
  everyDays: [14, 28] as const,
  announceAheadDays: 2,
  rewardCoins: 20,
  /** After a defeat the next blight has this share of the hit points it would have had. */
  shrinkAfterDefeat: 0.5,
  /** Damage per source; room damage is per cleared room, once for the whole party, not per member. */
  damage: { kudos: 1, room: 2, raid_room: 10 } as const,
} as const;

export type BlightSource = keyof typeof BLIGHT.damage;

export function blightHp(activeMembers: number, lastDefeated = false): number {
  const base = Math.max(BLIGHT.minHp, BLIGHT.hpPerActiveMember * Math.max(0, whole(activeMembers)));
  return lastDefeated ? Math.max(BLIGHT.minHp, Math.round(base * BLIGHT.shrinkAfterDefeat)) : base;
}

/**
 * Damage one event deals the blight: a qualifying kudos line, or a room the party cleared. Rooms
 * that took no effort (rest, secret) and rooms not cleared (fallen, retreated) deal nothing.
 */
export function blightDamage(event: { source: "kudos" } | { source: "room" | "raid_room"; room: Room; done: "cleared" | "fallen" | "retreated" | null }): number {
  if (event.source === "kudos") return BLIGHT.damage.kudos;
  if (event.done !== "cleared" || event.room.kind === "rest" || event.room.kind === "secret") return 0;
  return BLIGHT.damage[event.source];
}
