import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { drawSecret } from "../hoggies/drops";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { mostRandomEmojis, randomEmojiNamesIn } from "./emojiClasses";
import { randomEmojisShownTo } from "./flag";
import { emojiRollOf } from "./emojiRoll";

export { mostRandomEmojis };

export const randomEmojiChance = 0.1;

export const mostRandomEmojisShown = 200;

export type RandomEmojiId = `random:${string}`;

export type HeldRandomEmoji = { id: RandomEmojiId; name: string; image: string; from: MemberId; at: number };

export async function dropRandomEmojiFrom(ctx: MutationCtx, member: MemberId, pack: Id<"thoughtfulPacks">, crate: string, at: number): Promise<void> {
  if (!(await randomEmojisShownTo(ctx, member))) return;
  const { chance, pick } = await emojiRollOf({ secret: drawSecret(), member, crate });
  if (chance >= randomEmojiChance) return;
  const { workspace } = await chatUserOf(ctx, member);
  const offered: string[] = [];
  for (const name of await randomEmojiNamesIn(ctx, workspace)) if (!(await holdsRandomEmoji(ctx, member, name))) offered.push(name);
  const name = offered[Math.floor(pick * offered.length)];
  if (name === undefined || (await customEmojiImageOf(ctx, workspace, name)) === undefined) return;
  await ctx.db.insert("randomEmojiDrops", { member, name, pack, at });
}

export async function randomEmojisHeldBy(ctx: QueryCtx, workspace: string, member: MemberId): Promise<HeldRandomEmoji[]> {
  const held: HeldRandomEmoji[] = [];
  if (!(await randomEmojisShownTo(ctx, member))) return held;
  for (const { name, pack, at } of await dropsOf(ctx, member)) {
    const image = await customEmojiImageOf(ctx, workspace, name);
    const packed = await ctx.db.get(pack);
    if (image !== undefined && packed !== null) held.push({ id: `random:${name}`, name, image, from: packed.recipient, at });
  }
  return held;
}

export async function holdsRandomEmoji(ctx: QueryCtx, member: MemberId, name: string): Promise<boolean> {
  const drop = await ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member).eq("name", name))
    .first();
  return drop !== null;
}

function dropsOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member))
    .take(mostRandomEmojisShown);
}
