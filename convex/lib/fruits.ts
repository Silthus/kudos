/**
 * Tree fruit (#152 §S3): what the Ancient Tree drops when a player claims the appreciation they
 * gave. One fruit per five Hog coins claimed over a player's lifetime (so small daily claims still
 * add up to fruit), its kind rolled by weight. A fruit is an inventory item with exactly one
 * effect, applied where it belongs: the stall sells sun fruit, moon fruit restores stamina, amber
 * is a Lucky charm charge, star discounts a home stage, heart plants a Super seed. The tree never
 * drops fruit for anything but a claim, so fruit is still kudos.
 */
import { whole as wholeNumber } from "./numbers";

export type FruitId = "sun" | "moon" | "amber" | "star" | "heart";

export type FruitEffect =
  | { kind: "sell"; coins: number }
  | { kind: "stamina"; amount: number }
  | { kind: "luckyCharm"; charges: number }
  | { kind: "homeDiscount"; percent: number }
  | { kind: "superSeed"; plantStage: "sapling" };

export type Fruit = { id: FruitId; name: string; about: string; weight: number; effect: FruitEffect };

export const FRUITS: Fruit[] = [
  { id: "sun", name: "Sun fruit", about: "Sells for 3 Hog coins at the stall.", weight: 60, effect: { kind: "sell", coins: 3 } },
  { id: "moon", name: "Moon fruit", about: "Restores 1 stamina for an expedition.", weight: 25, effect: { kind: "stamina", amount: 1 } },
  { id: "amber", name: "Amber fruit", about: "One Lucky charm charge: your next thoughtful kudos rolls its message Uncommon or better.", weight: 10, effect: { kind: "luckyCharm", charges: 1 } },
  { id: "star", name: "Star fruit", about: "A quarter off your home's next build stage.", weight: 4, effect: { kind: "homeDiscount", percent: 25 } },
  { id: "heart", name: "Heart fruit", about: "A Super seed: plants a garden plant that starts as a Sapling.", weight: 1, effect: { kind: "superSeed", plantStage: "sapling" } },
];

export const FRUIT_BY_ID = Object.fromEntries(FRUITS.map((f) => [f.id, f])) as Record<FruitId, Fruit>;
/** Coins claimed per fruit dropped. */
export const FRUIT_PER_COINS = 5;

export function isFruitId(id: string): id is FruitId {
  return Object.hasOwn(FRUIT_BY_ID, id);
}

export function fruitEffect(id: FruitId): FruitEffect {
  return FRUIT_BY_ID[id].effect;
}

const whole = (n: number) => Math.max(0, wholeNumber(n));

/** Fruit a claim drops, given the coins claimed before it and after it, so no coin is ever lost to rounding. */
export function fruitsBetween(claimedBefore: number, claimedAfter: number): number {
  return Math.max(0, Math.floor(whole(claimedAfter) / FRUIT_PER_COINS) - Math.floor(whole(claimedBefore) / FRUIT_PER_COINS));
}

const TOTAL_WEIGHT = FRUITS.reduce((n, f) => n + f.weight, 0);

/** `count` fruit by weight, in drop order; `rand` is a seeded [0, 1) source so a claim replays. */
export function rollFruits(count: number, rand: () => number): FruitId[] {
  return Array.from({ length: whole(count) }, () => {
    let roll = rand() * TOTAL_WEIGHT;
    for (const f of FRUITS) {
      roll -= f.weight;
      if (roll < 0) return f.id;
    }
    return FRUITS[FRUITS.length - 1].id;
  });
}
