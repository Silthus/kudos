import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { renderMondayPost } from "../feedback/mondayPost";
import type { MondayPostOutcome } from "../leaderboard/mondayPostOutcome";
import { attemptCall, slackTextOf, type Attempt } from "./delivery";

export const postMondayPost = observedAction({
  args: { workspace: v.string(), generation: v.number() },
  handler: async (ctx, { workspace, generation }) => {
    const claimed = await ctx.runMutation(internal.leaderboard.mondayPost.claimWeek, { workspace, generation });
    if (claimed === null) return;
    const sent = await attemptCall(ctx, workspace, "chat.postMessage", { channel: claimed.channel, text: slackTextOf(renderMondayPost(claimed.post)) });
    await ctx.runMutation(internal.leaderboard.mondayPost.recordOutcome, { claim: claimed.claim, outcome: outcomeOf(sent) });
  },
});

function outcomeOf(sent: Attempt): MondayPostOutcome {
  if (sent.kind === "delivered") return "posted";
  return sent.kind === "gone" ? "cant-post" : "failed";
}
