import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { canSpend, coinBalance } from "./lib/coins";

/**
 * Spends Hog coins outside the Store (a garden plant, a skill reset, a home's plot or stage): the
 * whole `cost` must be in the member's balance, and it's added to `members.coinsSpent` in the caller's
 * transaction, so two spends racing for the same coins can't both win. `what` names it in the refusal:
 * "A plot costs 40 Hog coins; you have 12." The Store's purchases and redemptions keep their own path
 * (store.ts), with its price checks and ledger rows.
 */
export async function spendCoins(ctx: MutationCtx, member: Doc<"members">, player: Doc<"players">, cost: number, what: string) {
  const { balance } = coinBalance(player, member);
  if (!canSpend(balance, cost)) throw new ConvexError(`${what} costs ${cost} Hog coins; you have ${balance}.`);
  await ctx.db.patch(member._id, { coinsSpent: (member.coinsSpent ?? 0) + cost });
}
