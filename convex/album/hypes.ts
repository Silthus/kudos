import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { hypeEarnedBy } from "./earnedEmojis";
import { emojiNamed } from "./emojiNames";

export type HypeEmoji = { owner: MemberId; held: boolean };

const hypePrefix = "hype:";

export async function hypeEmojiFor(ctx: QueryCtx, workspace: string, giver: MemberId | null, name: string): Promise<HypeEmoji | null> {
  const owner = ownerOf(await emojiNamed(ctx, workspace, name));
  if (owner === null) return null;
  return { owner, held: giver !== null && (await hypeEarnedBy(ctx, giver, owner)) };
}

function ownerOf(emoji: string | null): MemberId | null {
  return emoji?.startsWith(hypePrefix) === true ? (emoji.slice(hypePrefix.length) as MemberId) : null;
}
