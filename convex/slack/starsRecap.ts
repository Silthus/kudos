import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import type { Recap, RecapLine } from "../stars/recap";
import { settingsFooterText } from "./appHomeLinks";
import { attemptCall, retryAfter, slackLink, tryAtMostThreeTimes } from "./delivery";

export const sendStarsRecap = observedAction({
  args: { week: v.id("starWeeks"), attempt: v.number() },
  handler: async (ctx, { week, attempt }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const recap = await ctx.runMutation(internal.stars.recap.startRecap, { week, attempt });
        if (recap === null) return null;
        const sent = await attemptCall(ctx, recap.workspace, "chat.postMessage", { channel: recap.user, text: textOf(recap) });
        if (sent.kind !== "delivered" && sent.kind !== "gone") return retryAfter(sent, attempt);
        await ctx.runMutation(internal.stars.recap.recapEnded, { week, attempt, sent: sent.kind === "delivered" });
        return null;
      },
      (retry) => ctx.runMutation(internal.stars.recap.recapLater, { week, attempt, retry }),
      () => ctx.runMutation(internal.stars.recap.recapEnded, { week, attempt, sent: false }),
    );
  },
});

function textOf({ workspace, lines, footer }: Recap) {
  return [...lines.map(lineTextOf), ...(footer === null ? [] : [settingsFooterText(workspace, footer)])].join("\n");
}

function lineTextOf(line: RecapLine) {
  return typeof line === "string" ? line : `${line.text}${slackLink(line.link)}`;
}
