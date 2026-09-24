import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { BOOSTERS, type BoosterKey, type ItemKey, LUCKY_CHARM } from "./lib/items";
import { BOOST_NAME, type BoostKind } from "./lib/boosts";
import { dayKeyFor } from "./lib/time";
import { clearSkillTree, resetBlocker } from "./skills";
import { boostOn, startBonusDay } from "./boosts";
import { spreeJoinsInMonth } from "./sprees";

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
  /**
   * Why this member can't buy the item right now (shown on the item), or null when they can.
   * `today` is the workspace day it's asked for: the viewer's day in a query, the purchase's day.
   */
  unavailable?: (ctx: QueryCtx, buyer: Buyer & { today: string }) => Promise<string | null>;
  /** Applies the item instantly: no approval. */
  apply: (ctx: MutationCtx, buyer: Buyer & { now: number; month: string; price: number }, purchaseId: Id<"itemPurchases">) => Promise<void>;
  /**
   * Takes the item back, for the shared demo's "Hand back" (`undoPurchase`). Without it the
   * purchase can't be handed back, e.g. once its effect is spent; returning `false` keeps this one.
   */
  undo?: (ctx: MutationCtx, purchase: Doc<"itemPurchases">) => Promise<void | false>;
};

/** Why no company-wide booster can start today: one is on already (§G10: one at a time). */
async function boostBlocker(ctx: QueryCtx, workspace: Doc<"workspaces">, today: string, kind: BoostKind) {
  const on = await boostOn(ctx, workspace._id, today);
  if (on) {
    return `${on.kind === "double" ? "Today is a bonus day already" : `The ${BOOST_NAME[on.kind].toLowerCase()} is on today already`}. One at a time: try again tomorrow.`;
  }
  if (kind === "unsung" && workspace.receivedVisibility !== "everyone") {
    return "The unsung bonus needs received counts visible to everyone, and they aren't in this workspace.";
  }
  return null;
}

/**
 * A company-wide booster (#97, §G10): bought by one member, on for everyone from now until the end
 * of the workspace day, and announced. No `undo`: kudos given meanwhile earned double, and a boost
 * is never rewritten once it started (a rebuild must replay it).
 */
function booster(key: BoosterKey): ItemEffect {
  const kind = BOOSTERS[key];
  return {
    unavailable: async (ctx, { workspace, today }) => await boostBlocker(ctx, workspace, today, kind),
    apply: async (ctx, { workspace, member, now }, purchaseId) => {
      const started = await startBonusDay(ctx, workspace, dayKeyFor(now, workspace.timezone), "booster", { by: member._id, kind, purchaseId, now });
      if (!started) throw new ConvexError("Another boost started today a moment ago. One at a time: try again tomorrow.");
    },
  };
}

export const ITEM_EFFECTS: Record<ItemKey, ItemEffect> = {
  // The purchase row is the join: kudos sprees (sprees.ts `spreeJoinsOf`) add the joins bought in a
  // month to the 5 everyone gets. One can be handed back only while that month's joins don't need it.
  spreeJoin: {
    apply: async () => {},
    undo: async (ctx, purchase) => {
      const joins = await spreeJoinsInMonth(ctx, purchase.memberId, purchase.month);
      if (joins.used > joins.allowed - 1) return false;
    },
  },
  // The skill tree's reset (#92), the same one as on the skill tree page: every point comes back
  // and the next reset costs more. No `undo`: the points are back the moment it applies.
  skillReset: {
    unavailable: async (_ctx, { player }) => resetBlocker(player),
    apply: async (ctx, { player, price, now }) => await clearSkillTree(ctx, player, price, now),
  },
  // Uses stack on the player; the give path spends one per thoughtful kudos (engine.ts). No
  // `undo`: a charm starts working with the next kudos, so it can't always be taken back whole.
  luckyCharm: {
    unavailable: async (_ctx, { workspace }) =>
      workspace.notifyReceiver ? null : "In this workspace receivers get no message when they're thanked, so there's nothing to roll.",
    apply: async (ctx, { player }) => {
      const fresh = (await ctx.db.get(player._id))!;
      await ctx.db.patch(player._id, { luckyCharms: (fresh.luckyCharms ?? 0) + LUCKY_CHARM.uses });
    },
  },
  // Kept on the player until used from a garden (gardens.ts). No `undo`: one may be used already.
  sunlamp: {
    apply: async (ctx, { player }) => {
      const fresh = (await ctx.db.get(player._id))!;
      await ctx.db.patch(player._id, { sunlamps: (fresh.sunlamps ?? 0) + 1 });
    },
  },
  lantern: {
    apply: async (ctx, { player }) => {
      const fresh = (await ctx.db.get(player._id))!;
      await ctx.db.patch(player._id, { lanterns: (fresh.lanterns ?? 0) + 1 });
    },
  },
  boosterDouble: booster("boosterDouble"),
  boosterNewConnections: booster("boosterNewConnections"),
  boosterRekindles: booster("boosterRekindles"),
  boosterUnsung: booster("boosterUnsung"),
};

/**
 * The Lucky charm at work (§G10), from the give path: a batch with thoughtful kudos spends one use
 * of the giver's charms, and returns who gets their message rolled at Uncommon or better (every
 * receiver of a thoughtful kudos in it). One message is one kudos, however many it thanks. A
 * revoke never gives a use back: the message was rolled.
 */
export async function spendLuckyCharm(ctx: MutationCtx, giverId: Id<"members">, qualifying: Id<"members">[]): Promise<Set<Id<"members">>> {
  if (qualifying.length === 0) return new Set();
  const player = await ctx.db
    .query("players")
    .withIndex("by_member", (q) => q.eq("memberId", giverId))
    .unique();
  if (!player || (player.luckyCharms ?? 0) <= 0) return new Set();
  await ctx.db.patch(player._id, { luckyCharms: player.luckyCharms! - 1 });
  return new Set(qualifying);
}

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
