import type { Doc } from "../_generated/dataModel";
import { BOOST_EFFECT, type BoostKind } from "./boosts";
import { LANTERN, SUNLAMP_DAYS } from "./garden";
import { type Allocation, rankOf, resetCost } from "./skills";
import { COSMETICS, type CosmeticKey, EMOJI_VARIANTS, type VariantItemKey } from "./cosmetics";
import { dayKeyFor } from "./time";

/**
 * The Store's pure rules (#55 §G5, ADR 0002): who may shop, and the built-in **game items** that
 * apply instantly and need no approval. Prices are in Hog coins only.
 *
 * Adding a game item (boosters #97, cosmetics #98, …) never touches the Store core:
 *   1. add its key to `ItemKey` and a definition to `ITEMS` here (name, copy, price, monthly limit);
 *   2. add its effect to `ITEM_EFFECTS` in `convex/items.ts` (when it can't be bought, and what
 *      buying it does, in the purchase's transaction).
 * `buyItem` in `convex/store.ts` does the rest: the level gate, the price the member saw, the
 * monthly limit, the balance check and the debit, all in one transaction.
 */

/** The shop opens at this level; before that it's visible but locked (§G1, `GAME_AREAS`). */
export const SHOP_LEVEL = 5;

/**
 * - `off`: the workspace doesn't play the game, so there is no currency and no Store;
 * - `hidden`: the member hides the game (it comes back with everything intact);
 * - `locked`: below level 5, shown with how to get there;
 * - `open`: they can shop.
 */
export type ShopAccess = "off" | "hidden" | "locked" | "open";

export function shopAccess(
  workspace: Pick<Doc<"workspaces">, "gameEnabled">,
  member: Pick<Doc<"members">, "gameHidden">,
  level: number,
): ShopAccess {
  if (workspace.gameEnabled !== true) return "off";
  if (member.gameHidden) return "hidden";
  return level >= SHOP_LEVEL ? "open" : "locked";
}

/**
 * Real rewards (catalog, request → approve → fulfil) sit behind their own admin switch, off by
 * default, and are priced in Hog coins, so they need the game too. The old `storeEnabled` switch
 * opened a store priced in received kudos and is never read: its prices were never re-set in coins.
 */
export function realRewardsOn(workspace: Pick<Doc<"workspaces">, "gameEnabled" | "realRewardsEnabled">): boolean {
  return workspace.gameEnabled === true && workspace.realRewardsEnabled === true;
}

/** The workspace calendar month ("YYYY-MM") a moment falls in: monthly item limits count by it. */
export function monthOf(ts: number, timeZone: string): string {
  return dayKeyFor(ts, timeZone).slice(0, 7);
}

export type ItemKey = "spreeJoin" | "skillReset" | "luckyCharm" | "sunlamp" | "lantern" | BoosterKey | CosmeticKey | VariantItemKey;

/** The company-wide boosters (#97, §G10): one item per kind of boost (lib/boosts.ts). */
export type BoosterKey = "boosterDouble" | "boosterNewConnections" | "boosterRekindles" | "boosterUnsung";
export const BOOSTERS: Record<BoosterKey, BoostKind> = {
  boosterDouble: "double",
  boosterNewConnections: "new_connection",
  boosterRekindles: "rekindle",
  boosterUnsung: "unsung",
};

/** How many of an item a member bought before: ever, and in the current workspace month. */
export type Bought = { ever: number; thisMonth: number };

/** What of the buyer's player row a price may depend on. */
export type ItemPlayer = Partial<Pick<Doc<"players">, "skillResets" | "skills">>;

/** Lucky charm (#97, §G10): uses per charm, its price, and the Herald's Charm maker discount per rank. */
export const LUCKY_CHARM = { uses: 3, price: 12, discountPerRank: 3 } as const;

export type ItemDef = {
  key: ItemKey;
  name: string;
  /** One line on what it does, in the Store and on Slack. */
  description: string;
  /** The price of the next one, which may rise with what was bought before or with the player's state. */
  price: (bought: Bought, player: ItemPlayer) => number;
  /** At most this many a workspace month; undefined: no limit. */
  perMonth?: number;
};

export const ITEMS: readonly ItemDef[] = [
  {
    key: "spreeJoin",
    name: "Extra spree join",
    description: "One more kudos spree to join this month, on top of your 5.",
    // A join pays its joiner at most 5 coins (1 at its tier, 1 per later tier), so buying joins
    // can never turn a profit (§G6: sprees earn at most about 25 coins a month).
    price: () => 8,
    perMonth: 5,
  },
  {
    key: "skillReset",
    name: "Skill-tree reset",
    description: "Returns every skill point you spent, so you can grow a different tree.",
    // The skill tree's own price (#92): more each time, counting resets on the skill tree page too.
    price: (_bought, player) => resetCost(player.skillResets ?? 0),
  },
  {
    key: "luckyCharm",
    name: "Lucky charm",
    description: `Your next ${LUCKY_CHARM.uses} thoughtful kudos roll each receiver's message at Uncommon or better.`,
    price: (_bought, player) => LUCKY_CHARM.price - LUCKY_CHARM.discountPerRank * rankOf(player.skills as Allocation | undefined, "charm_discount"),
  },
  // Garden boosters (§G10): kept until used from the garden (gardens.ts useSunlamp, hangLantern).
  {
    key: "sunlamp",
    name: "Sunlamp",
    description: `One plant in your garden skips ${SUNLAMP_DAYS} days of its wait for the next stage. It still needs every watering.`,
    price: () => 15,
    perMonth: 3,
  },
  {
    key: "lantern",
    name: "Lantern",
    description: `Hang a one-line note on a plant in a teammate's garden. It glows there for ${LANTERN.days} days.`,
    price: () => 5,
    perMonth: 5,
  },
  // Company-wide (§G10): everyone gains, so they cost more than anything personal, and one is on at a
  // time. A Double is a whole bonus day; the conditional ones only double one kind of kudos.
  {
    key: "boosterDouble",
    name: "Kudos booster: Double",
    description: `Until midnight, ${BOOST_EFFECT.double} for everyone. Announced to the workspace.`,
    price: () => 40,
    perMonth: 1,
  },
  {
    key: "boosterNewConnections",
    name: "Kudos booster: New connections",
    description: `Until midnight, ${BOOST_EFFECT.new_connection}, for everyone. Announced to the workspace.`,
    price: () => 20,
    perMonth: 2,
  },
  {
    key: "boosterRekindles",
    name: "Kudos booster: Rekindles",
    description: `Until midnight, ${BOOST_EFFECT.rekindle}, for everyone. Announced to the workspace.`,
    price: () => 20,
    perMonth: 2,
  },
  {
    key: "boosterUnsung",
    name: "Kudos booster: The unsung",
    description: `Until midnight, ${BOOST_EFFECT.unsung}, for everyone. Announced to the workspace.`,
    price: () => 20,
    perMonth: 2,
  },
  // Cosmetics (#98): bought once, worn at once (`convex/cosmetics.ts`), shown on your profile and next to your name.
  ...COSMETICS.map((c) => ({ key: c.key, name: c.name, description: c.description, price: () => c.price })),
  // Kudos-emoji variants (#98): give exactly like the kudos emoji, only for their owner.
  ...EMOJI_VARIANTS.flatMap(({ item, source, name, suffix }) =>
    item && source.kind === "store"
      ? [{ key: item, name, description: `Your own kudos emoji to give with: its name plus “-${suffix}”. It gives the same, and only you can use it.`, price: () => source.price }]
      : [],
  ),
];

export function itemByKey(key: string): ItemDef | undefined {
  return ITEMS.find((i) => i.key === key);
}

export function quoteItem(item: ItemDef, bought: Bought, player: ItemPlayer): { price: number; limitReached: boolean } {
  return { price: item.price(bought, player), limitReached: item.perMonth !== undefined && bought.thisMonth >= item.perMonth };
}
