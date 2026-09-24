import type { Doc } from "../_generated/dataModel";
import { resetCost } from "./skills";
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

export type ItemKey = "spreeJoin" | "skillReset";

/** How many of an item a member bought before: ever, and in the current workspace month. */
export type Bought = { ever: number; thisMonth: number };

/** What of the buyer's player row a price may depend on. */
export type ItemPlayer = Partial<Pick<Doc<"players">, "skillResets">>;

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
];

export function itemByKey(key: string): ItemDef | undefined {
  return ITEMS.find((i) => i.key === key);
}

export function quoteItem(item: ItemDef, bought: Bought, player: ItemPlayer): { price: number; limitReached: boolean } {
  return { price: item.price(bought, player), limitReached: item.perMonth !== undefined && bought.thisMonth >= item.perMonth };
}
