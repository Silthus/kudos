/**
 * Hog coins: the pure rules of the game's only currency (#55 §G2, G4; ADR 0002). Coins come from
 * *giving* thoughtfully, never from receiving: a qualifying kudos earns its giver 1 per kudos given
 * (the allowance caps it), and every level reached earns 10. Quests, sprees and garden fruit add
 * their own sources later. Coins never turn into kudos or allowance, and kudos never turn into coins.
 *
 * The ledger (convex/game.ts): coins from kudos ride the per-batch `gameEvents` (a `coins` field on
 * each give line), summed into `players.coins`, so a revoke takes back exactly what its kudos earned.
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

/** What one kudos row earns its giver: only a qualifying kudos earns, 1 per kudos given. */
export function lineCoins(line: { qualifying: boolean; amount: number }): number {
  return line.qualifying ? COINS.perKudos * line.amount : 0;
}

export type CoinBalance = {
  /** What can be spent: earned − spent ± adjustments. Below zero after a revoke, which blocks spending. */
  balance: number;
  fromKudos: number;
  /** Picked in the garden (`players.fruitCoins`, part of `players.coins`). */
  fromFruit: number;
  fromLevels: number;
  spent: number;
  adjusted: number;
};

/**
 * A member's coins. `player.coins` is what their events earned (kudos, garden fruit; later quests
 * and sprees), of which `fruitCoins` came from fruit; and every level above 1 earned 10.
 */
export function coinBalance(
  player: { coins?: number; fruitCoins?: number; level: number },
  member: { coinsSpent?: number; coinsAdjusted?: number } = {},
): CoinBalance {
  const fromFruit = player.fruitCoins ?? 0;
  const fromKudos = (player.coins ?? 0) - fromFruit;
  const fromLevels = COINS.levelUp * (player.level - 1);
  const spent = member.coinsSpent ?? 0;
  const adjusted = member.coinsAdjusted ?? 0;
  return { balance: fromKudos + fromFruit + fromLevels - spent + adjusted, fromKudos, fromFruit, fromLevels, spent, adjusted };
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
