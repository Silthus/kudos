import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { ItemKey } from "./lib/items";
import { clearSkillTree, resetBlocker } from "./skills";

/**
 * What each game item does (the definitions, prices and limits are in `lib/items.ts`). The Store
 * core (`purchaseItem` in store.ts) checks the level, the price, the monthly limit and the balance,
 * records the purchase, debits the coins and then calls `apply`, all in one transaction, so an
 * effect that throws undoes the purchase too. A later ticket adds its item here and in `ITEMS`,
 * never in the Store core.
 */

export type Buyer = {
  workspace: Doc<"workspaces">;
  member: Doc<"members">;
  player: Doc<"players">;
};

export type ItemEffect = {
  /** Why this member can't buy the item right now (shown on the item), or null when they can. */
  unavailable?: (ctx: QueryCtx, buyer: Buyer) => Promise<string | null>;
  /** Applies the item instantly: no approval. */
  apply: (ctx: MutationCtx, buyer: Buyer & { now: number; month: string; price: number }, purchaseId: Id<"itemPurchases">) => Promise<void>;
  /**
   * Takes the item back, for the shared demo's "Hand back" (`undoPurchase`). Without it the
   * purchase can't be handed back, e.g. once its effect is spent.
   */
  undo?: (ctx: MutationCtx, purchase: Doc<"itemPurchases">) => Promise<void>;
};

export const ITEM_EFFECTS: Record<ItemKey, ItemEffect> = {
  // The purchase row is the join: kudos sprees (#94) add `itemsBought(ctx, memberId, "spreeJoin",
  // month)` to the 5 joins everyone gets that month. Nothing can use a join yet, so handing one back
  // is safe; #94 must make `undo` refuse (throw) once the month's joins include a used bought one.
  spreeJoin: { apply: async () => {}, undo: async () => {} },
  // The skill tree's reset (#92), the same one as on the skill tree page: every point comes back
  // and the next reset costs more. No `undo`: the points are back the moment it applies.
  skillReset: {
    unavailable: async (_ctx, { player }) => resetBlocker(player),
    apply: async (ctx, { player, price, now }) => await clearSkillTree(ctx, player, price, now),
  },
};

/** Counted reads stop here; item prices and limits never depend on more than this. */
export const PURCHASES_COUNTED = 100;

/** How many of an item a member bought in a workspace month ("YYYY-MM"), or ever. */
export async function itemsBought(ctx: QueryCtx, memberId: Id<"members">, item: ItemKey, month?: string) {
  const rows = await ctx.db
    .query("itemPurchases")
    .withIndex("by_member_item_month", (q) => (month === undefined ? q.eq("memberId", memberId).eq("item", item) : q.eq("memberId", memberId).eq("item", item).eq("month", month)))
    .take(PURCHASES_COUNTED);
  return rows.length;
}
