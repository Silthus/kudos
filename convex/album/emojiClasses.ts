import type { MutationCtx, QueryCtx } from "../_generated/server";

export type EmojiClass = "random" | "unmapped";

export const mostRandomEmojis = 100;

export async function emojiClassesIn(ctx: QueryCtx, workspace: string): Promise<Map<string, EmojiClass>> {
  const rows = await ctx.db
    .query("emojiClasses")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace))
    .collect();
  return new Map(rows.map(({ name, class: emojiClass }) => [name, emojiClass]));
}

export async function randomEmojiNamesIn(ctx: QueryCtx, workspace: string): Promise<string[]> {
  const rows = await ctx.db
    .query("emojiClasses")
    .withIndex("by_workspace_class", (q) => q.eq("workspace", workspace).eq("class", "random"))
    .take(mostRandomEmojis);
  return rows.map(({ name }) => name);
}

export async function isClassed(ctx: QueryCtx, workspace: string, name: string): Promise<boolean> {
  return (await classRowOf(ctx, workspace, name)) !== null;
}

export async function classEmoji(ctx: MutationCtx, workspace: string, name: string, emojiClass: EmojiClass): Promise<boolean> {
  const row = await classRowOf(ctx, workspace, name);
  if (row?.class === emojiClass) return true;
  if (emojiClass === "random" && (await randomEmojiNamesIn(ctx, workspace)).length >= mostRandomEmojis) return false;
  if (row === null) await ctx.db.insert("emojiClasses", { workspace, name, class: emojiClass });
  else await ctx.db.patch(row._id, { class: emojiClass });
  return true;
}

export async function unclassEmoji(ctx: MutationCtx, workspace: string, name: string): Promise<void> {
  const row = await classRowOf(ctx, workspace, name);
  if (row !== null) await ctx.db.delete(row._id);
}

function classRowOf(ctx: QueryCtx, workspace: string, name: string) {
  return ctx.db
    .query("emojiClasses")
    .withIndex("by_workspace_name", (q) => q.eq("workspace", workspace).eq("name", name))
    .unique();
}
