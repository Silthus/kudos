import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const abandonedAfterMs = 24 * 60 * 60 * 1000;
const deletionBatchSize = 500;

export const deleteAbandoned = internalMutation({
  args: {},
  handler: async (ctx) => {
    const abandoned = await ctx.db
      .query("authVerifiers")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", Date.now() - abandonedAfterMs))
      .take(deletionBatchSize);
    await Promise.all(abandoned.map((verifier) => ctx.db.delete(verifier._id)));
    if (abandoned.length === deletionBatchSize) await ctx.scheduler.runAfter(0, internal.website.abandonedHandshakes.deleteAbandoned, {});
  },
});
