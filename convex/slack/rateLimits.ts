import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";

const methodArgs = { workspace: v.string(), method: v.string() };

export const heldUntil = internalQuery({
  args: methodArgs,
  handler: async (ctx, method): Promise<number> => (await holdOf(ctx, method))?.until ?? 0,
});

export const hold = internalMutation({
  args: { ...methodArgs, until: v.number() },
  handler: async (ctx, { until, ...method }) => {
    const existing = await holdOf(ctx, method);
    if (existing === null) await ctx.db.insert("slackRateLimits", { ...method, until });
    else if (existing.until < until) await ctx.db.patch(existing._id, { until });
  },
});

function holdOf(ctx: QueryCtx, { workspace, method }: { workspace: string; method: string }) {
  return ctx.db
    .query("slackRateLimits")
    .withIndex("by_method", (q) => q.eq("workspace", workspace).eq("method", method))
    .unique();
}
