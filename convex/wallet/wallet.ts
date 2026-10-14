import { v, type Infer } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { ReportableError } from "../analytics/exceptions";
import { perkValidator } from "../progression/tree";
import type { MemberId } from "../workspace/directory";

export const spentForValidator = v.object({ perk: perkValidator });

export const coinSpendValidator = v.object({ member: v.id("members"), coins: v.number(), for: spentForValidator, at: v.number() });

export type CoinSpend = Infer<typeof coinSpendValidator>;

export type Spent = "spent" | "no-coins";

export type Wallet = { balance: number };

export const walletOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<Wallet> => ({ balance: await balanceOf(ctx, member) }),
});

export async function balanceOf(ctx: QueryCtx, member: MemberId): Promise<number> {
  return (await walletRow(ctx, member))?.balance ?? 0;
}

export async function credit(ctx: MutationCtx, member: MemberId, coins: number) {
  if (wholeCoins(coins) === 0) return;
  await setBalance(ctx, member, (await balanceOf(ctx, member)) + coins);
}

export async function spend(ctx: MutationCtx, spending: CoinSpend): Promise<Spent> {
  if (wholeCoins(spending.coins) === 0) return "spent";
  const balance = await balanceOf(ctx, spending.member);
  if (balance < spending.coins) return "no-coins";
  await setBalance(ctx, spending.member, balance - spending.coins);
  await ctx.db.insert("coinSpends", spending);
  return "spent";
}

function wholeCoins(coins: number) {
  if (!Number.isInteger(coins) || coins < 0) throw new ReportableError("not a whole number of coins");
  return coins;
}

async function setBalance(ctx: MutationCtx, member: MemberId, balance: number) {
  const row = await walletRow(ctx, member);
  if (row === null) await ctx.db.insert("wallets", { member, balance });
  else await ctx.db.patch(row._id, { balance });
}

function walletRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("wallets")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
