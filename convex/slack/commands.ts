import { v } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction, internalAction, internalMutation } from "../_generated/server";
import { recordUsage } from "../analytics/usage";
import { type KudosCommandResult, renderKudosCommandReply } from "../feedback/kudosCommand";
import { lookup } from "../workspace/directory";
import { readSignedBody } from "./signature";
import { callSlack, type SlackAnswer } from "./webApi";

const commandArgs = { workspace: v.string(), user: v.string(), alias: v.boolean(), arrivedAt: v.number() };

const kudosCommandResultValidator = v.union(v.literal("joined"), v.literal("already-in"), v.literal("private-channel"), v.literal("direct-message"));

export const slackCommands = httpAction(async (ctx, request) => {
  const arrivedAt = Date.now();
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const command = new URLSearchParams(new TextDecoder().decode(body));
  await ctx.scheduler.runAfter(0, internal.slack.commands.addToChannel, {
    workspace: field(command, "team_id"),
    user: field(command, "user_id"),
    alias: field(command, "command") === "/kudos",
    arrivedAt,
    channel: field(command, "channel_id"),
    inDirectMessage: isDirectMessage(command),
    responseUrl: field(command, "response_url"),
  });
  return new Response(null, { status: 200 });
});

export const addToChannel = internalAction({
  args: { ...commandArgs, channel: v.string(), inDirectMessage: v.boolean(), responseUrl: v.string() },
  handler: async (ctx, { channel, inDirectMessage, responseUrl, ...used }) => {
    const answer = await callSlack("conversations.join", { channel });
    const result = resultOfJoining(answer, inDirectMessage);
    await ctx.runMutation(internal.slack.commands.reportCommandUsed, { ...used, result });
    await answerCommand(responseUrl, renderKudosCommandReply(result));
  },
});

export const reportCommandUsed = internalMutation({
  args: { ...commandArgs, result: kudosCommandResultValidator },
  handler: async (ctx, { workspace, user, alias, arrivedAt, result }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await recordUsage(ctx, { kind: "commandUsed", workspace, member: person.member, alias, result, at: arrivedAt });
  },
});

const unjoinableChannelErrors = new Set(["channel_not_found", "method_not_supported_for_channel_type"]);

function isDirectMessage(command: URLSearchParams) {
  const name = field(command, "channel_name");
  return name === "directmessage" || name.startsWith("mpdm-");
}

function resultOfJoining(answer: SlackAnswer, inDirectMessage: boolean): KudosCommandResult {
  if (answer.ok) return answer.warning === "already_in_channel" ? "already-in" : "joined";
  if (inDirectMessage) return "direct-message";
  if (unjoinableChannelErrors.has(answer.error)) return "private-channel";
  throw new Error(`Slack conversations.join failed: ${answer.error}`);
}

async function answerCommand(responseUrl: string, text: string) {
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
