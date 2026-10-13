import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";

export const on = internalQuery({
  args: messageRefValidator,
  handler: async (ctx, ref): Promise<string[]> => (await placedOn(ctx, ref))?.emoji ?? [],
});

export const remember = internalMutation({
  args: { ref: messageRefValidator, emoji: v.string() },
  handler: async (ctx, { ref, emoji }) => {
    const existing = await placedOn(ctx, ref);
    if (existing === null) await ctx.db.insert("placedReactions", { ...ref, emoji: [emoji] });
    else if (!existing.emoji.includes(emoji)) await ctx.db.patch(existing._id, { emoji: [...existing.emoji, emoji] });
  },
});

export const forget = internalMutation({
  args: { ref: messageRefValidator, emoji: v.string() },
  handler: async (ctx, { ref, emoji }) => {
    const existing = await placedOn(ctx, ref);
    if (existing !== null) await ctx.db.patch(existing._id, { emoji: existing.emoji.filter((placed) => placed !== emoji) });
  },
});

function placedOn(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("placedReactions")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
