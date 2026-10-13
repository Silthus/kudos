import { v } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction, internalAction } from "../_generated/server";
import { type KudosCommandResult, renderKudosCommandReply } from "../feedback/kudosCommand";
import { readSignedBody } from "./signature";
import { callSlack } from "./webApi";

export const slackCommands = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const command = new URLSearchParams(new TextDecoder().decode(body));
  await ctx.scheduler.runAfter(0, internal.slack.commands.addToChannel, {
    channel: field(command, "channel_id"),
    inDirectMessage: isDirectMessage(command),
    responseUrl: field(command, "response_url"),
  });
  return new Response(null, { status: 200 });
});

export const addToChannel = internalAction({
  args: { channel: v.string(), inDirectMessage: v.boolean(), responseUrl: v.string() },
  handler: async (_ctx, { channel, inDirectMessage, responseUrl }) => {
    const result = inDirectMessage ? "direct-message" : await join(channel);
    await replyPrivately(responseUrl, renderKudosCommandReply(result));
  },
});

function isDirectMessage(command: URLSearchParams) {
  const name = field(command, "channel_name");
  return name === "directmessage" || name.startsWith("mpdm-");
}

async function join(channel: string): Promise<KudosCommandResult> {
  const answer = await callSlack("conversations.join", { channel });
  if (answer.ok) return answer.warning === "already_in_channel" ? "already-in" : "joined";
  if (answer.error === "method_not_supported_for_channel_type") return "private-channel";
  throw new Error(`Slack conversations.join failed: ${answer.error}`);
}

async function replyPrivately(responseUrl: string, text: string) {
  const response = await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
  if (!response.ok) throw new Error(`Slack response_url answered HTTP ${response.status}`);
}

function field(command: URLSearchParams, name: string) {
  const value = command.get(name);
  if (value === null) throw new Error(`the slash command has no ${name}`);
  return value;
}
