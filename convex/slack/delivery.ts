import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { messageRefValidator } from "../engine/messageEvent";
import { callSlack } from "./webApi";

const reactionAlreadyShown = "already_reacted";

export const deliverIndicator = internalAction({
  args: messageRefValidator,
  handler: async (ctx, ref) => {
    const indicator = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    if (indicator === null) return;
    const answer = await callSlack("reactions.add", { channel: ref.conversation, timestamp: ref.message, name: indicator.emoji });
    if (!answer.ok && answer.error !== reactionAlreadyShown) console.warn(`reactions.add failed: ${answer.error}`);
  },
});
