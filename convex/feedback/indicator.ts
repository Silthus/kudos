import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";

export type Indicator = { emoji: string } | null;
export type DesiredIndicator = { indicator: Indicator; version: number };

export async function setIndicator(ctx: MutationCtx, ref: MessageRef, indicator: Indicator) {
  const emoji = indicator?.emoji ?? null;
  const existing = await indicatorRow(ctx, ref);
  if (existing === null) await ctx.db.insert("indicators", { ...ref, emoji, version: 1 });
  else await ctx.db.patch(existing._id, { emoji, version: existing.version + 1 });
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverIndicator, ref);
}

export const desired = internalQuery({
  args: messageRefValidator,
  handler: async (ctx, ref): Promise<DesiredIndicator> => {
    const row = await indicatorRow(ctx, ref);
    return { indicator: row?.emoji ? { emoji: row.emoji } : null, version: row?.version ?? 0 };
  },
});

function indicatorRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("indicators")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
