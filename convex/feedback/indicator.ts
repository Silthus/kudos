import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";

export type Indicator = { emoji: string } | null;

export type IndicatorState = { desired: Indicator; replaced: string[] };

export async function setIndicator(ctx: MutationCtx, ref: MessageRef, indicator: Indicator) {
  const emoji = indicator?.emoji ?? null;
  const existing = await indicatorRow(ctx, ref);
  if (existing === null) await ctx.db.insert("indicators", { ...ref, emoji, replaced: [] });
  else await ctx.db.patch(existing._id, { emoji, replaced: replacedBy(existing, emoji) });
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverIndicator, ref);
}

export const desired = internalQuery({
  args: messageRefValidator,
  handler: async (ctx, ref): Promise<IndicatorState> => {
    const row = await indicatorRow(ctx, ref);
    return { desired: row?.emoji ? { emoji: row.emoji } : null, replaced: row?.replaced ?? [] };
  },
});

function replacedBy(row: Doc<"indicators">, emoji: string | null) {
  const everShown = [...row.replaced, ...(row.emoji === null ? [] : [row.emoji])];
  return [...new Set(everShown)].filter((name) => name !== emoji);
}

function indicatorRow(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("indicators")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
