import type { QueryCtx } from "../_generated/server";
import { storedAnnotationsOf } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { gateDecisionOf } from "../progression/gate";
import type { MemberId } from "../workspace/directory";
import { albumStickersOf, type AlbumSticker } from "./stickers";

export const kudosSearchedForAKindNote = 50;

export const newestPeopleShown = 4;

export type KindNote = { giver: MemberId; message: MessageRef; at: number };

export async function lastKindNoteTo(ctx: QueryCtx, member: MemberId): Promise<KindNote | null> {
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient_at", (q) => q.eq("recipient", member))
    .order("desc")
    .take(kudosSearchedForAKindNote);
  for (const { giver, workspace, conversation, message, at } of received) {
    const ref = { workspace, conversation, message };
    if (gateDecisionOf(await storedAnnotationsOf(ctx, ref))?.thoughtful === true) return { giver, message: ref, at };
  }
  return null;
}

export async function newestStickersOf(ctx: QueryCtx, member: MemberId, searched: number): Promise<AlbumSticker[]> {
  const { stickers } = await albumStickersOf(ctx, member, searched);
  return stickers.toSorted((one, other) => other.at - one.at).slice(0, newestPeopleShown);
}
