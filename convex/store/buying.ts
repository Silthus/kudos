import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { openedAtOf } from "../unlocks/unlocks";
import { spend } from "../wallet/wallet";
import { chatUserOf, type MemberId } from "../workspace/directory";
import type { ItemId } from "./catalogue";
import { grantItem, owns, storeItemFor } from "./inventory";
import type { ItemPurchaseOutcome, ItemRefusal } from "./rows";
import { storeShownTo } from "./visibility";

export async function buyItem(ctx: MutationCtx, member: MemberId, item: ItemId, idempotencyKey: string): Promise<ItemPurchaseOutcome | null> {
  if (!(await storeShownTo(ctx, member))) return null;
  const earlier = await purchaseOf(ctx, member, idempotencyKey);
  if (earlier !== null) return earlier.outcome;
  const outcome = await purchase(ctx, member, item, Date.now());
  await ctx.db.insert("itemPurchases", { member, key: idempotencyKey, outcome });
  return outcome;
}

async function purchase(ctx: MutationCtx, member: MemberId, item: ItemId, at: number): Promise<ItemPurchaseOutcome> {
  const refused = (reason: ItemRefusal["reason"]): ItemRefusal => ({ kind: "refused", item, reason });
  if ((await openedAtOf(ctx, member, "coins")) === null) return refused("coins-not-open");
  const sold = await storeItemFor(ctx, member, item);
  if (sold === null) return refused("not-for-sale");
  if (await owns(ctx, member, item)) return refused("owned");
  const { price } = sold.source;
  if ((await spend(ctx, { member, coins: price, for: { item }, at })) === "no-coins") return refused("no-coins");
  await grantItem(ctx, { member, item, source: "store", arrivedAt: at });
  await publish(ctx, { type: "itemBought", workspace: (await chatUserOf(ctx, member)).workspace, member, item, price, at });
  return { kind: "bought", item };
}

function purchaseOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("itemPurchases")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
