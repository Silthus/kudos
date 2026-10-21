import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type AlbumSticker = { person: MemberId; at: number };

export async function albumStickersOf(ctx: QueryCtx, member: MemberId, atMost: number): Promise<{ stickers: AlbumSticker[]; more: boolean }> {
  const stickers = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .take(atMost + 1);
  return { stickers: stickers.slice(0, atMost).map(({ person, at }) => ({ person, at })), more: stickers.length > atMost };
}

export async function inTheAlbumOf(ctx: QueryCtx, member: MemberId, person: MemberId) {
  const sticker = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
  return sticker !== null;
}

export async function isPutInFrom(ctx: QueryCtx, member: MemberId, person: MemberId, pack: Id<"thoughtfulPacks">): Promise<boolean> {
  const sticker = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
  return sticker?.from === "pack" && sticker.pack === pack;
}

export async function recordHistorySticker(ctx: MutationCtx, member: MemberId, person: MemberId, at: number) {
  if (member === person || (await inTheAlbumOf(ctx, member, person))) return;
  await ctx.db.insert("albumStickers", { member, person, from: "history", at });
}

export async function recordPackSticker(ctx: MutationCtx, member: MemberId, person: MemberId, pack: Id<"thoughtfulPacks">, at: number): Promise<boolean> {
  if (member === person || (await inTheAlbumOf(ctx, member, person))) return false;
  await ctx.db.insert("albumStickers", { member, person, from: "pack", pack, at });
  return true;
}

export async function peopleHeldBy(ctx: QueryCtx, member: MemberId): Promise<Set<MemberId>> {
  const stickers = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .collect();
  return new Set(stickers.map(({ person }) => person));
}

export async function nextStickerHolderAfter(ctx: QueryCtx, after: MemberId | null): Promise<MemberId | null> {
  const next = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => (after === null ? q : q.gt("member", after)))
    .first();
  return next?.member ?? null;
}

export async function holdsAnySticker(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  const sticker = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .first();
  return sticker !== null;
}
