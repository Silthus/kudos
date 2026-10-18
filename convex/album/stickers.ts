import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type AlbumSticker = { person: MemberId; at: number };

export async function albumStickersOf(ctx: QueryCtx, member: MemberId): Promise<AlbumSticker[]> {
  const stickers = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .collect();
  return stickers.map(({ person, at }) => ({ person, at }));
}

export async function inTheAlbumOf(ctx: QueryCtx, member: MemberId, person: MemberId) {
  const sticker = await ctx.db
    .query("albumStickers")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
  return sticker !== null;
}

export async function recordHistorySticker(ctx: MutationCtx, member: MemberId, person: MemberId, at: number) {
  if (member === person || (await inTheAlbumOf(ctx, member, person))) return;
  await ctx.db.insert("albumStickers", { member, person, from: "history", at });
}
