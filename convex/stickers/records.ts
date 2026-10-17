import { v } from "convex/values";
import { awardIdValidator, earliestAwardFrom, type EarliestAward } from "../engine/awards";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const stickerValidator = v.object({
  member: v.id("members"),
  person: v.id("members"),
  firstAward: awardIdValidator,
  firstAt: v.number(),
});

export const stickerBackfillValidator = v.object({
  workspace: v.string(),
  cursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

export type HeldSticker = { person: MemberId; firstAt: number };

export type Pair = { giver: MemberId; recipient: MemberId };

export async function recordStickersOf(ctx: MutationCtx, { giver, recipient }: Pair): Promise<MemberId[]> {
  if (giver === recipient) return [];
  const missing = await stickersMissingOf(ctx, [
    { member: giver, person: recipient },
    { member: recipient, person: giver },
  ]);
  if (missing.length === 0) return [];
  const first = await earliestAwardBetween(ctx, giver, recipient);
  if (first === null) return [];
  for (const owner of missing) await ctx.db.insert("stickers", { ...owner, firstAward: first.award, firstAt: first.at });
  return missing.map(({ member }) => member);
}

export async function stickersNewestFirst(ctx: QueryCtx, member: MemberId): Promise<HeldSticker[]> {
  const stickers = await ctx.db
    .query("stickers")
    .withIndex("by_member_firstAt", (q) => q.eq("member", member))
    .order("desc")
    .collect();
  return stickers.map(({ person, firstAt }) => ({ person, firstAt }));
}

type Owner = { member: MemberId; person: MemberId };

async function stickersMissingOf(ctx: QueryCtx, owners: Owner[]): Promise<Owner[]> {
  const missing: Owner[] = [];
  for (const owner of owners) if (!(await holds(ctx, owner))) missing.push(owner);
  return missing;
}

async function holds(ctx: QueryCtx, { member, person }: Owner) {
  const sticker = await ctx.db
    .query("stickers")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
  return sticker !== null;
}

async function earliestAwardBetween(ctx: QueryCtx, one: MemberId, other: MemberId): Promise<EarliestAward | null> {
  const [given, received] = await Promise.all([earliestAwardFrom(ctx, one, other), earliestAwardFrom(ctx, other, one)]);
  if (given === null || received === null) return given ?? received;
  return given.created <= received.created ? given : received;
}
