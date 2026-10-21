import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { welcomeNudgeCauseValidator, type WelcomeNudgeMessage } from "../feedback/welcomeNudge";
import { escaped, mrkdwn, urlButtonOf } from "./blocks";
import { attemptArgs, sendAtMostOnce, slackLink, tryAtMostThreeTimes } from "./delivery";

const waitingLine = "Your rare hoggie is waiting for you to collect it.";

export const deliverWelcomeNudge = observedAction({
  args: { workspace: v.string(), user: v.string(), member: v.id("members"), cause: welcomeNudgeCauseValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...nudge }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcomeNudge.welcomeNudgeMessage, { workspace: nudge.workspace, member: nudge.member, cause: nudge.cause });
        return message === null ? null : sendAtMostOnce(ctx, nudge.workspace, "chat.postMessage", { channel: nudge.user, ...messageOf(message) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcomeNudge.deliverWelcomeNudge, { ...nudge, attempt: retry.attempt }),
    );
  },
});

function messageOf(message: WelcomeNudgeMessage) {
  const lead = leadOf(message);
  const quote = message.cause.kind === "thanks" && message.cause.quote !== null ? `\n>${escaped(message.cause.quote)}` : "";
  return {
    text: `${lead}\n${waitingLine}`,
    blocks: [
      { type: "section", text: mrkdwn(`${lead}${quote}`) },
      { type: "section", text: mrkdwn(waitingLine) },
      { type: "actions", elements: [urlButtonOf({ label: "Open your HedgeHug album", url: message.album, actionId: "welcome-nudge-open-album" })] },
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
}

function leadOf({ giver, kudosEmoji, cause }: WelcomeNudgeMessage) {
  if (cause.kind === "thanks") return `<@${giver}> thanked you :${kudosEmoji}:`;
  const label = cause.onKudos ? "hugged a kudos you got" : "hugged your message";
  const hugged = cause.permalink === null ? label : slackLink({ url: cause.permalink, label });
  return `<@${giver}> ${hugged} :${kudosEmoji}:`;
}
