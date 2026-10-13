import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { WelcomeMessage } from "../feedback/welcome";
import { appHomeLink } from "./appHome";
import { callSlack } from "./webApi";

const maxAttempts = 3;
const retryWithoutRetryAfterMs = 1000;

type Failure = { retryAfterMs?: number };

export const deliverWelcome = internalAction({
  args: { workspace: v.string(), user: v.string(), attempt: v.number() },
  handler: async (ctx, delivery) => {
    const welcome = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: delivery.workspace });
    const failure = await sendDirectMessage(delivery.user, textOf(welcome, delivery.workspace));
    if (failure === null || delivery.attempt >= maxAttempts) return;
    const retryInMs = failure.retryAfterMs ?? retryWithoutRetryAfterMs;
    await ctx.scheduler.runAfter(retryInMs, internal.slack.welcome.deliverWelcome, { ...delivery, attempt: delivery.attempt + 1 });
  },
});

async function sendDirectMessage(user: string, text: string): Promise<Failure | null> {
  try {
    const answer = await callSlack("chat.postMessage", { channel: user, text });
    if (answer.ok) return null;
    console.warn(`chat.postMessage failed: ${answer.error}`);
    return answer;
  } catch (error) {
    console.warn(`chat.postMessage failed: ${String(error)}`);
    return {};
  }
}

function textOf(welcome: WelcomeMessage, workspace: string) {
  return [...welcome.lines, appHomeLink(workspace, welcome.openAppHome)].join("\n");
}
