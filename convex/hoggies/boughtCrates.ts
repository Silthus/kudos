import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { Surface } from "../commands/surface";
import { coinsVisibleTo } from "../wallet/visibility";
import { spend } from "../wallet/wallet";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { catalogue } from "./catalogue";
import type { CrateKey } from "./crateKey";
import { dropFor, dropOf, type Drop } from "./drops";
import { crateStoreOpenFor, hoggiesShownTo } from "./flag";
import type { CratePurchaseOutcome, CrateRefusal } from "./records";

export type CrateStore = { price: number; next: number };

export async function buyCrate(ctx: MutationCtx, member: MemberId, next: number, at: number): Promise<CratePurchaseOutcome | null> {
  if (!(await hoggiesShownTo(ctx, member)) || !(await crateStoreOpenFor(ctx, member))) return null;
  const crate = boughtCrateKeyOf(next);
  const refused = (reason: CrateRefusal["reason"]): CrateRefusal => ({ kind: "refused", crate, reason });
  if ((await boughtCrateOf(ctx, member, crate)) !== null) return { kind: "bought", crate };
  if (next !== (await boughtSoFar(ctx, member)) + 1) return refused("stale");
  if (!(await coinsVisibleTo(ctx, member))) return refused("coins-not-open");
  const price = catalogue.cratePrice;
  if ((await spend(ctx, { member, coins: price, for: { crate }, at })) === "no-coins") return refused("no-coins");
  await ctx.db.insert("boughtCrates", { member, crate, n: next, boughtAt: at });
  await publish(ctx, { type: "crateBought", workspace: (await chatUserOf(ctx, member)).workspace, member, crate, price, at });
  return { kind: "bought", crate };
}

export async function openCrate(ctx: MutationCtx, member: MemberId, crate: string, at: number, surface: Surface): Promise<void> {
  const bought = await boughtCrateOf(ctx, member, crate);
  if (bought === null || bought.openedAt !== undefined || !(await hoggiesShownTo(ctx, member))) return;
  await dropFor(ctx, member, boughtCrateKeyOf(bought.n), at, surface);
  await ctx.db.patch(bought._id, { openedAt: at });
}

export async function openedCrateDropOf(ctx: MutationCtx, member: MemberId, crate: string): Promise<Drop | null> {
  const bought = await boughtCrateOf(ctx, member, crate);
  if (bought?.openedAt === undefined || !(await hoggiesShownTo(ctx, member))) return null;
  return dropOf(ctx, member, boughtCrateKeyOf(bought.n));
}

export async function crateStoreOf(ctx: QueryCtx, member: MemberId): Promise<CrateStore | null> {
  return (await coinsVisibleTo(ctx, member)) ? { price: catalogue.cratePrice, next: (await boughtSoFar(ctx, member)) + 1 } : null;
}

export async function waitingCratesOf(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  const waiting = await ctx.db
    .query("boughtCrates")
    .withIndex("by_member_opened", (q) => q.eq("member", member).eq("openedAt", undefined))
    .collect();
  return waiting.map(({ crate }) => crate);
}

export type BoughtCrateWaiting = { crate: string; at: number };

export async function boughtCratesWaitingFor(ctx: QueryCtx, member: MemberId, limit: number): Promise<BoughtCrateWaiting[]> {
  const waiting = await ctx.db
    .query("boughtCrates")
    .withIndex("by_member_opened", (q) => q.eq("member", member).eq("openedAt", undefined))
    .take(limit);
  return waiting.map(({ crate, boughtAt }) => ({ crate, at: boughtAt }));
}

export async function boughtCrateOpened(ctx: QueryCtx, member: MemberId, crate: string): Promise<boolean> {
  return (await boughtCrateOf(ctx, member, crate))?.openedAt !== undefined;
}

function boughtCrateKeyOf(next: number): CrateKey {
  return `bought:${next}`;
}

async function boughtSoFar(ctx: QueryCtx, member: MemberId) {
  const last = await ctx.db
    .query("boughtCrates")
    .withIndex("by_member_n", (q) => q.eq("member", member))
    .order("desc")
    .first();
  return last?.n ?? 0;
}

function boughtCrateOf(ctx: QueryCtx, member: MemberId, crate: string): Promise<Doc<"boughtCrates"> | null> {
  return ctx.db
    .query("boughtCrates")
    .withIndex("by_member_crate", (q) => q.eq("member", member).eq("crate", crate))
    .unique();
}
