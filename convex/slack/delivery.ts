import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { messageRefValidator } from "../engine/messageEvent";
import { callSlack } from "./web";

const reactionAlreadyShown = "already_reacted";

export const deliverIndicator = internalAction({
  args: messageRefValidator,
  handler: async (ctx, ref) => {
    const indicator = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    if (indicator === null) return;
    const result = await callSlack("reactions.add", { channel: ref.conversation, timestamp: ref.message, name: indicator.emoji });
    if (!result.ok && result.error !== reactionAlreadyShown) console.warn(`reactions.add failed: ${result.error}`);
  },
});
