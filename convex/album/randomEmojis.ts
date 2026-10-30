import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { drawSecret } from "./hoggies/drops";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { slackEmojiImageOf } from "../workspace/slackEmoji";
import { mostRandomEmojis, randomEmojiNamesIn } from "./emojiClasses";
import { randomEmojisShownTo } from "./flag";
import { emojiRollOf } from "./emojiRoll";

export { mostRandomEmojis };

export const randomEmojiChance = 0.1;

export const mostRandomEmojisShown = 200;

export type RandomEmojiId = `random:${string}`;

const randomPrefix = "random:";

export type HeldRandomEmoji = { id: RandomEmojiId; name: string; image: string; from: MemberId; at: number };

export async function dropRandomEmojiFrom(ctx: MutationCtx, member: MemberId, pack: Id<"thoughtfulPacks">, crate: string, at: number): Promise<void> {
  if (!(await randomEmojisShownTo(ctx, member))) return;
  const { chance, pick } = await emojiRollOf({ secret: drawSecret(), member, crate });
  if (chance >= randomEmojiChance) return;
  const { workspace } = await chatUserOf(ctx, member);
  const offered: string[] = [];
  for (const name of await randomEmojiNamesIn(ctx, workspace)) if (!(await holdsRandomEmoji(ctx, member, name))) offered.push(name);
  const name = offered[Math.floor(pick * offered.length)];
  if (name === undefined || (await slackEmojiImageOf(ctx, workspace, name)) === undefined) return;
  await ctx.db.insert("randomEmojiDrops", { member, name, pack, at });
}

export async function randomEmojisHeldBy(ctx: QueryCtx, workspace: string, member: MemberId, picked: string[] = []): Promise<HeldRandomEmoji[]> {
  const held: HeldRandomEmoji[] = [];
  if (!(await randomEmojisShownTo(ctx, member))) return held;
  for (const { name, pack, at } of await pickedDropsFirstOf(ctx, member, picked)) {
    const image = await slackEmojiImageOf(ctx, workspace, name);
    const packed = await ctx.db.get(pack);
    if (image !== undefined && packed !== null) held.push({ id: `random:${name}`, name, image, from: packed.recipient, at });
  }
  return held;
}

export async function holdsRandomEmoji(ctx: QueryCtx, member: MemberId, name: string): Promise<boolean> {
  return (await dropNamed(ctx, member, name)) !== null;
}

export async function randomEmojiNamesHeldBy(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  const drops = await ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member))
    .collect();
  return drops.map(({ name }) => name);
}

async function pickedDropsFirstOf(ctx: QueryCtx, member: MemberId, picked: string[]) {
  const pickedDrops = [];
  for (const emoji of picked) {
    const drop = emoji.startsWith(randomPrefix) ? await dropNamed(ctx, member, emoji.slice(randomPrefix.length)) : null;
    if (drop !== null) pickedDrops.push(drop);
  }
  const pickedNames = new Set(pickedDrops.map(({ name }) => name));
  return [...pickedDrops, ...(await dropsOf(ctx, member)).filter(({ name }) => !pickedNames.has(name))].slice(0, mostRandomEmojisShown);
}

function dropNamed(ctx: QueryCtx, member: MemberId, name: string) {
  return ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member).eq("name", name))
    .first();
}

function dropsOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member))
    .take(mostRandomEmojisShown);
}
