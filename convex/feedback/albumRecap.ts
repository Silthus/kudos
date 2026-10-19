import type { QueryCtx } from "../_generated/server";
import { emojisEarnedBetween, type ShownEmoji } from "../album/earnedEmojis";
import type { Instants } from "../album/packs";
import { websiteOrigin } from "../website/link";
import type { MemberId } from "../workspace/directory";
import { albumSlackAppliesTo, publicPictureOf } from "./albumSlack";

export type RecapEmojiPicture = { url: string; name: string };

export type RecapEmojiLine = { text: string; pictures: RecapEmojiPicture[] };

export async function emojiLineOf(ctx: QueryCtx, owner: { workspace: string; member: MemberId }, week: Instants): Promise<RecapEmojiLine | null> {
  if (!(await albumSlackAppliesTo(ctx, owner.member))) return null;
  const earned = await emojisEarnedBetween(ctx, owner, week);
  if (earned.length === 0) return null;
  const origin = await websiteOrigin(ctx, owner.workspace);
  return { text: `Emojis you earned last week: ${earned.map(writtenNameOf).join(", ")}`, pictures: earned.flatMap((emoji) => pictureOf(emoji, origin)) };
}

function writtenNameOf({ name, inSlack }: ShownEmoji) {
  return inSlack ? `:${name}:` : name;
}

function pictureOf({ name, picture }: ShownEmoji, origin: string | null): RecapEmojiPicture[] {
  const url = publicPictureOf(picture, origin);
  return url === null ? [] : [{ url, name }];
}
