import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";

export type Indicator = { emoji: string } | null;

export async function setIndicator(ctx: MutationCtx, ref: MessageRef, indicator: Indicator) {
  const emoji = indicator?.emoji ?? null;
  const existing = await indicatorRow(ctx, ref);
  if (existing === null) await ctx.db.insert("indicators", { ...ref, emoji });
  else await ctx.db.patch(existing._id, { emoji });
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverIndicator, ref);
}

export const desired = internalQuery({
  args: messageRefValidator,
  handler: async (ctx, ref): Promise<Indicator> => {
    const row = await indicatorRow(ctx, ref);
    return row?.emoji ? { emoji: row.emoji } : null;
  },
});

function indicatorRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("indicators")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
