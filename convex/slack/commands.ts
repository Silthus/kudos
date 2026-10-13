import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx } from "../_generated/server";
import { observedAction, observedHttpAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import { type KudosCommandResult, renderKudosCommandReply } from "../feedback/kudosCommand";
import { renderEveryoneBoard, renderLeaderboardUsage } from "../feedback/leaderboard";
import type { Line } from "../feedback/replies";
import type { Period } from "../leaderboard/periods";
import { lookup } from "../workspace/directory";
import { attemptArgs, failedAttempt, slackTextOf, tryAtMostThreeTimes } from "./delivery";
import { lookUpUser, type LookUp } from "./directory";
import { readSignedBody } from "./signature";
import { callSlack, type SlackAnswer } from "./webApi";

const commandArgs = { workspace: v.string(), user: v.string(), alias: v.boolean(), arrivedAt: v.number() };

const kudosCommandResultValidator = v.union(v.literal("joined"), v.literal("already-in"), v.literal("private-channel"), v.literal("direct-message"));

const commandUsedArgs = { ...commandArgs, result: kudosCommandResultValidator };

type Viewer = { workspace: string; user: string };

export const slackCommands = observedHttpAction(async (ctx, request) => {
  const arrivedAt = Date.now();
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const command = new URLSearchParams(new TextDecoder().decode(body));
  const [argument, ...rest] = argumentsOf(command);
  if (argument === "leaderboard" && (await isEveryoneBoardShown(ctx, command))) return replyPrivately(await leaderboardReply(ctx, command, rest));

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
    const result = resultOfJoining(await callSlack("conversations.join", { channel }), inDirectMessage);
    await ctx.scheduler.runAfter(0, internal.slack.commands.reportCommandUsed, { ...used, result });
    await answerCommand(responseUrl, renderKudosCommandReply(result));
  },
});

export const reportCommandUsed = observedAction({
  args: { ...commandUsedArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...used }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const person = await knownOrLookedUp(ctx, used);
        if (person.kind === "failed") return failedAttempt(attempt, person.retryAfterMs);
        await recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.commands.recordCommandUsed, used));
        return null;
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.commands.reportCommandUsed, { ...used, attempt: retry.attempt }),
    );
  },
});

async function knownOrLookedUp(ctx: ActionCtx, { workspace, user }: Viewer): Promise<LookUp> {
  if (await ctx.runQuery(internal.slack.directory.knows, { workspace, user })) return { kind: "found" };
  return lookUpUser(ctx, workspace, user);
}

export const recordCommandUsed = internalMutation({
  args: commandUsedArgs,
  handler: async (ctx, { workspace, user, alias, arrivedAt, result }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await recordUsage(ctx, { kind: "commandUsed", workspace, member: person.member, alias, result, at: arrivedAt });
  },
});

async function isEveryoneBoardShown(ctx: ActionCtx, command: URLSearchParams) {
  const viewer = { workspace: field(command, "team_id"), user: field(command, "user_id") };
  const { shown, viewerKnown } = await ctx.runMutation(internal.leaderboard.flag.isEveryoneBoardShown, viewer);
  if (!viewerKnown) await ctx.scheduler.runAfter(0, internal.slack.commands.exposeBoardOnceKnown, { ...viewer, shown });
  return shown;
}

export const exposeBoardOnceKnown = observedAction({
  args: { workspace: v.string(), user: v.string(), shown: v.boolean(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...seen }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const person = await knownOrLookedUp(ctx, seen);
        if (person.kind === "failed") return failedAttempt(attempt, person.retryAfterMs);
        await ctx.runMutation(internal.leaderboard.flag.exposeEveryoneBoard, seen);
        return null;
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.commands.exposeBoardOnceKnown, { ...seen, attempt: retry.attempt }),
    );
  },
});

async function leaderboardReply(ctx: ActionCtx, command: URLSearchParams, rest: string[]): Promise<Line[]> {
  const viewer = { workspace: field(command, "team_id"), user: field(command, "user_id") };
  const unopened = await ctx.runQuery(internal.feedback.unlockFilter.unopenedReplyOf, { ...viewer, feature: "leaderboard" });
  if (unopened !== null) return unopened;
  const period = periodOf(rest);
  if (period === null) return renderLeaderboardUsage();
  const view = await ctx.runQuery(internal.leaderboard.totals.everyoneBoard, { workspace: field(command, "team_id"), viewer: field(command, "user_id"), period });
  return renderEveryoneBoard(view, period);
}

const periods: readonly Period[] = ["week", "month", "all"];

function periodOf(rest: string[]): Period | null {
  if (rest.length === 0) return "week";
  const [argument] = rest;
  return rest.length === 1 && periods.includes(argument as Period) ? (argument as Period) : null;
}

function replyPrivately(lines: Line[]) {
  return Response.json({ response_type: "ephemeral", text: slackTextOf(lines) });
}

function argumentsOf(command: URLSearchParams) {
  return (command.get("text") ?? "").trim().split(/\s+/).filter((word) => word !== "");
}

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
