import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { drawSecret } from "../hoggies/drops";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { emojiRollOf } from "./emojiRoll";

export const randomEmojiChance = 0.1;

export type RandomEmojiId = `random:${string}`;

export type HeldRandomEmoji = { id: RandomEmojiId; name: string; image: string };

export async function randomEmojiNamesIn(ctx: QueryCtx, workspace: string): Promise<Set<string>> {
  const rows = await ctx.db
    .query("randomEmojis")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
  return new Set(rows.map(({ name }) => name));
}

export async function classRandom(ctx: MutationCtx, workspace: string, name: string): Promise<void> {
  if ((await randomRowOf(ctx, workspace, name)) === null) await ctx.db.insert("randomEmojis", { workspace, name });
}

export async function unclassRandom(ctx: MutationCtx, workspace: string, name: string): Promise<void> {
  const row = await randomRowOf(ctx, workspace, name);
  if (row !== null) await ctx.db.delete(row._id);
}

export async function dropRandomEmojiFrom(ctx: MutationCtx, member: MemberId, pack: Id<"thoughtfulPacks">, crate: string, at: number): Promise<void> {
  const offered = await randomEmojisOfferedTo(ctx, member);
  if (offered.length === 0) return;
  const { chance, pick } = await emojiRollOf({ secret: drawSecret(), member, crate });
  if (chance >= randomEmojiChance) return;
  await ctx.db.insert("randomEmojiDrops", { member, name: offered[Math.floor(pick * offered.length)]!, pack, at });
}

export async function randomEmojisHeldBy(ctx: QueryCtx, workspace: string, member: MemberId): Promise<HeldRandomEmoji[]> {
  const held: HeldRandomEmoji[] = [];
  for (const { name } of await dropsOf(ctx, member)) {
    const image = await customEmojiImageOf(ctx, workspace, name);
    if (image !== undefined) held.push({ id: `random:${name}`, name, image });
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

async function randomEmojisOfferedTo(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const held = new Set((await dropsOf(ctx, member)).map(({ name }) => name));
  const offered: string[] = [];
  for (const name of await randomEmojiNamesIn(ctx, workspace)) if (!held.has(name) && (await customEmojiImageOf(ctx, workspace, name)) !== undefined) offered.push(name);
  return offered.toSorted();
}

function dropsOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("randomEmojiDrops")
    .withIndex("by_member_name", (q) => q.eq("member", member))
    .collect();
}

function randomRowOf(ctx: QueryCtx, workspace: string, name: string) {
  return ctx.db
    .query("randomEmojis")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
}
