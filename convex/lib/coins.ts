/**
 * Hog coins: the pure rules of the game's only currency (#55 §G2, G4; ADR 0002). Coins come from
 * *giving* thoughtfully, never from receiving: a qualifying kudos earns its giver 1 per kudos given
 * (the allowance caps it), every level reached earns 10, and garden fruit (#95) and quests (#93) pay
 * their own. Sprees add theirs later. Coins never turn into kudos or allowance, and kudos never turn
 * into coins.
 *
 * The ledger (convex/game.ts): coins from kudos ride the per-batch `gameEvents` (a `coins` field on
 * each give line) and wait at the tree as the batch's offering (convex/offerings.ts, #157) until the
 * giver claims it; only claimed coins are in `players.coins` (and the balance), so a revoke takes back
 * exactly what its kudos earned, from the offering or, once claimed, from the wallet.
 * Fruit (`harvest` events) and quest pay (`quest` events) go into the same sum; `players.fruitCoins`
 * and `players.questCoins` keep their shares apart, and `fromKudos` is what's left.
 * Level-up coins follow from `players.level`, which never goes down, so they are never taken back.
 * Spending and admin adjustments are kept on the member (`coinsSpent`, `coinsAdjusted`).
 */

export const COINS = {
  /** Per kudos given in a qualifying kudos (two tacos to one person earn 2). */
  perKudos: 1,
  /** Per level reached. */
  levelUp: 10,
} as const;

/** The wallet appears at this level with everything collected silently so far (§G1). */
export const WALLET_LEVEL = 3;

/**
 * What one kudos row earns its giver: only a qualifying kudos earns, 1 per kudos given, doubled
 * when a bonus day or booster doubled the line (`boosted`, lib/xp.ts `scoreGive`; §G9).
 */
export function lineCoins(line: { qualifying: boolean; amount: number; boosted?: boolean }): number {
  return line.qualifying ? COINS.perKudos * line.amount * (line.boosted ? 2 : 1) : 0;
}

export type CoinBalance = {
  /** What can be spent: earned − spent ± adjustments. Below zero after a revoke, which blocks spending. */
  balance: number;
  /** Coins from kudos waiting at the tree: not in the balance until claimed at the offering stone. */
  waiting: number;
  /** Claimed at the tree (or credited straight away, before #157). */
  fromKudos: number;
  /** Picked in the garden (`players.fruitCoins`, part of `players.coins`). */
  fromFruit: number;
  /** Weekly and daily quests (from level 5, §G11). */
  fromQuests: number;
  /** Paid by kudos sprees' tiers (`players.spreeCoins`, part of `players.coins`). */
  fromSprees: number;
  fromLevels: number;
  spent: number;
  adjusted: number;
};

/**
 * A member's coins. `player.coins` is what their events earned (kudos claimed at the tree, fruit,
 * quests and sprees), of which `fruitCoins` came from fruit (garden fruit picked and tree fruit sold),
 * `questCoins` from quests and `spreeCoins` from sprees; and every level above 1 earned 10. `waiting`
 * is what waits at the tree (convex/offerings.ts `waiting`), shown apart and never spendable.
 */
export function coinBalance(
  player: { coins?: number; fruitCoins?: number; questCoins?: number; spreeCoins?: number; level: number },
  member: { coinsSpent?: number; coinsAdjusted?: number } = {},
  waiting = 0,
): CoinBalance {
  const fromFruit = player.fruitCoins ?? 0;
  const fromQuests = player.questCoins ?? 0;
  const fromSprees = player.spreeCoins ?? 0;
  const fromKudos = (player.coins ?? 0) - fromFruit - fromQuests - fromSprees;
  const fromLevels = COINS.levelUp * (player.level - 1);
  const spent = member.coinsSpent ?? 0;
  const adjusted = member.coinsAdjusted ?? 0;
  return {
    balance: fromKudos + fromFruit + fromQuests + fromSprees + fromLevels - spent + adjusted,
    waiting,
    fromKudos,
    fromFruit,
    fromQuests,
    fromSprees,
    fromLevels,
    spent,
    adjusted,
  };
}

/** Spending needs the whole price in the balance; a negative balance blocks it until it recovers. */
export function canSpend(balance: number, cost: number): boolean {
  return balance >= cost;
}

/** "1 Hog coin", "−3 Hog coins", "1,200 Hog coins": how amounts of coins read everywhere. */
export function formatCoins(n: number): string {
  const digits = Math.abs(n).toLocaleString("en-US");
  return `${n < 0 ? "−" : ""}${digits} Hog coin${Math.abs(n) === 1 ? "" : "s"}`;
}
