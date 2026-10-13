import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx } from "../_generated/server";
import { observedAction, observedHttpAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { recordUsage } from "../analytics/usage";
import { type KudosCommandResult, renderKudosCommandReply } from "../feedback/kudosCommand";
import { lookup } from "../workspace/directory";
import { lookUpUser } from "./directory";
import { readSignedBody } from "./signature";
import { callSlack, type SlackAnswer } from "./webApi";

const commandArgs = { workspace: v.string(), user: v.string(), alias: v.boolean(), arrivedAt: v.number() };

const kudosCommandResultValidator = v.union(v.literal("joined"), v.literal("already-in"), v.literal("private-channel"), v.literal("direct-message"));

const commandUsedArgs = { ...commandArgs, result: kudosCommandResultValidator };

type CommandUsed = ObjectType<typeof commandUsedArgs>;

export const slackCommands = observedHttpAction(async (ctx, request) => {
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

export const addToChannel = observedAction({
  args: { ...commandArgs, channel: v.string(), inDirectMessage: v.boolean(), responseUrl: v.string() },
  handler: async (ctx, { channel, inDirectMessage, responseUrl, ...used }) => {
    const answer = await callSlack("conversations.join", { channel });
    const result = resultOfJoining(answer, inDirectMessage);
    await answerCommand(responseUrl, renderKudosCommandReply(result));
    await reportCommandUsed(ctx, { ...used, result });
  },
});

async function reportCommandUsed(ctx: ActionCtx, used: CommandUsed) {
  const person = { workspace: used.workspace, user: used.user };
  if (!(await ctx.runQuery(internal.slack.directory.knows, person))) await lookUpUser(ctx, person.workspace, person.user);
  await ctx.runMutation(internal.slack.commands.recordCommandUsed, used);
}

export const recordCommandUsed = internalMutation({
  args: commandUsedArgs,
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
  throw new ReportableError(`Slack conversations.join failed: ${answer.error}`);
}

async function answerCommand(responseUrl: string, text: string) {
  const response = await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
  if (!response.ok) throw new ReportableError(`Slack response_url answered HTTP ${response.status}`);
}

function field(command: URLSearchParams, name: string) {
  const value = command.get(name);
  if (value === null) throw new ReportableError(`the slash command has no ${name}`);
  return value;
}
