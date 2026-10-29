import { getFunctionName, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { functionPathOf } from "../analytics/boundary";
import { subscribers } from "./publish";

export type Replayed = "replayed" | "not failed" | "not a subscriber" | "already replayed";

const sendsItsMessageAgainWhenDeliveredTwice = [
  internal.welcome.welcome.welcomeOnHug,
  internal.feedback.coins.tellCoinsOpened,
  internal.feedback.albumReplies.replyAfterTheGrant,
  internal.feedback.publicReplies.celebrateLevel,
].map(getFunctionName);

export const replay = internalMutation({
  args: { job: v.id("_scheduled_functions") },
  handler: async (ctx, { job }): Promise<Replayed> => {
    const scheduled = await ctx.db.system.get(job);
    if (scheduled?.state.kind !== "failed") return "not failed";
    const subscriber = functionPathOf(scheduled.name);
    if (!replayableSubscribers().includes(subscriber)) return "not a subscriber";
    if (await wasReplayed(ctx, job)) return "already replayed";
    await ctx.db.insert("replays", { job });
    await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">(subscriber), scheduled.args[0]);
    return "replayed";
  },
});

function replayableSubscribers() {
  return Object.values(subscribers)
    .flat()
    .map((subscription) => getFunctionName("subscriber" in subscription ? subscription.subscriber : subscription))
    .filter((name) => !sendsItsMessageAgainWhenDeliveredTwice.includes(name));
}

async function wasReplayed(ctx: MutationCtx, job: Id<"_scheduled_functions">) {
  const replayed = await ctx.db
    .query("replays")
    .withIndex("by_job", (q) => q.eq("job", job))
    .first();
  return replayed !== null;
}
