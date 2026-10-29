import type { QueryCtx } from "../_generated/server";
import { newestReceivedBy, type NewestReceived } from "../engine/awards";
import { wordsOf } from "../engine/kudosText";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { albumStickersOf, type AlbumSticker } from "./stickers";

export const kudosSearchedForAKindNote = 50;

export const newestPeopleShown = 4;

export type KindNote = NewestReceived;

export async function lastKindNoteTo(ctx: QueryCtx, member: MemberId): Promise<KindNote | null> {
  for (const award of await newestReceivedBy(ctx, member, kudosSearchedForAKindNote)) {
    if (await isReadable(ctx, award.message)) return award;
  }
  return null;
}

async function isReadable(ctx: QueryCtx, message: MessageRef) {
  return (await wordsOf(ctx, message)).kind === "text";
}

export async function newestStickersOf(ctx: QueryCtx, member: MemberId, searched: number): Promise<AlbumSticker[]> {
  const { stickers } = await albumStickersOf(ctx, member, searched);
  return stickers.toSorted((one, other) => other.at - one.at).slice(0, newestPeopleShown);
}
