import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx } from "../_generated/server";
import { observedAction, observedHttpAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import type { ViewedBoard } from "../analytics/projections";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import { type KudosCommandResult, renderKudosCommandReply } from "../feedback/kudosCommand";
import { renderBoards, renderFullBoardLink, renderLeaderboardUsage } from "../feedback/leaderboard";
import type { Line } from "../feedback/segments";
import { periodValidator, type Period } from "../leaderboard/periods";
import { lookup } from "../workspace/directory";
import { answerCommand, onceKnown, replyPrivately, type Viewer } from "./commandReplies";
import { attemptArgs } from "./delivery";
import { cardRequestOf, cardViewedValidator, recordProfileCardViewedWithoutBlocking } from "./profileCardCommand";
import { readSignedBody } from "./signature";
import { callSlack, type SlackAnswer } from "./webApi";

const commandArgs = { workspace: v.string(), user: v.string(), alias: v.boolean(), arrivedAt: v.number() };

const kudosCommandResultValidator = v.union(v.literal("joined"), v.literal("already-in"), v.literal("private-channel"), v.literal("direct-message"));

const commandUsedArgs = { ...commandArgs, result: kudosCommandResultValidator };

const viewedValidator = v.object({ period: periodValidator, arrivedAt: v.number(), groups: v.optional(v.boolean()), myGroup: v.optional(v.boolean()) });

const leaderboardViewedArgs = { workspace: v.string(), user: v.string(), ...viewedValidator.fields };

export const slackCommands = observedHttpAction(async (ctx, request) => {
  const arrivedAt = Date.now();
  const body = await readSignedBody(request);
  if (body === null) return new Response(null, { status: 401 });

  const command = new URLSearchParams(new TextDecoder().decode(body));
  const cardRequest = cardRequestOf(command.get("text") ?? "");
  if (cardRequest !== null) {
    const reply = await ctx.runMutation(internal.slack.profileCardCommand.profileCardReply, { ...viewerOf(command), arrivedAt, request: cardRequest, responseUrl: field(command, "response_url") });
    if (reply.shown) return reply.lines === null ? new Response(null, { status: 200 }) : replyPrivately(reply.lines);
  }

  const [argument, ...rest] = argumentsOf(command);
  if (argument === "leaderboard") {
    const viewer = viewerOf(command);
    const board = await ctx.runMutation(internal.leaderboard.flag.isEveryoneBoardShown, viewer);
    const reply = board.shown ? await leaderboardReply(ctx, viewer, rest) : null;
    await reportBoardRequest(ctx, viewer, board, reply?.period ? { period: reply.period, arrivedAt, ...reply.shown } : undefined);
    if (reply !== null) return replyPrivately(reply.lines);
  }

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
    await onceKnown(
      ctx,
      attempt,
      used,
      () => recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.commands.recordCommandUsed, used)),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.commands.reportCommandUsed, { ...used, attempt: retry.attempt }),
    );
  },
});

export const recordCommandUsed = internalMutation({
  args: commandUsedArgs,
  handler: async (ctx, { workspace, user, alias, arrivedAt, result }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await recordUsage(ctx, { kind: "commandUsed", workspace, member: person.member, alias, result, at: arrivedAt });
  },
});

export const recordLeaderboardViewed = internalMutation({
  args: leaderboardViewedArgs,
  handler: async (ctx, { workspace, user, period, arrivedAt, groups = false, myGroup = false }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return;
    const boards: ViewedBoard[] = ["everyone", ...(groups ? ["groups" as const] : []), ...(myGroup ? ["my-group" as const] : [])];
    for (const board of boards) await recordUsage(ctx, { kind: "leaderboardViewed", workspace, member: person.member, board, period, surface: "command", at: arrivedAt });
  },
});

type BoardRequest = { shown: boolean; viewerKnown: boolean };

type Viewed = Infer<typeof viewedValidator>;

async function reportBoardRequest(ctx: ActionCtx, viewer: Viewer, { shown, viewerKnown }: BoardRequest, viewed: Viewed | undefined) {
  if (!viewerKnown) await ctx.scheduler.runAfter(0, internal.slack.commands.exposeOnceKnown, { ...viewer, flag: "everyone-board", shown, ...(viewed && { viewed }) });
  else if (viewed) await recordLeaderboardViewedWithoutBlocking(ctx, viewer, viewed);
}

function recordLeaderboardViewedWithoutBlocking(ctx: ActionCtx, { workspace, user }: Viewer, viewed: Viewed) {
  return recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.commands.recordLeaderboardViewed, { workspace, user, ...viewed }));
}

const exposureOf = {
  "everyone-board": internal.leaderboard.flag.exposeEveryoneBoard,
  unlocks: internal.unlocks.launch.exposeUnlocks,
  "profile-card": internal.profileCard.flag.exposeProfileCard,
};

export const exposeOnceKnown = observedAction({
  args: {
    workspace: v.string(),
    user: v.string(),
    flag: v.union(v.literal("everyone-board"), v.literal("unlocks"), v.literal("profile-card")),
    shown: v.boolean(),
    viewed: v.optional(viewedValidator),
    cardViewed: v.optional(cardViewedValidator),
    ...attemptArgs,
  },
  handler: async (ctx, { attempt = 1, flag, viewed, cardViewed, ...seen }) => {
    await onceKnown(
      ctx,
      attempt,
      seen,
      async () => {
        await ctx.runMutation(exposureOf[flag], seen);
        if (viewed) await recordLeaderboardViewedWithoutBlocking(ctx, seen, viewed);
        if (cardViewed) await recordProfileCardViewedWithoutBlocking(ctx, { workspace: seen.workspace, user: seen.user, ...cardViewed });
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.commands.exposeOnceKnown, { ...seen, flag, ...(viewed && { viewed }), ...(cardViewed && { cardViewed }), attempt: retry.attempt }),
    );
  },
});

type ShownGroupBoards = { groups: boolean; myGroup: boolean };

const noGroupBoards: ShownGroupBoards = { groups: false, myGroup: false };

async function leaderboardReply(ctx: ActionCtx, viewer: Viewer, rest: string[]): Promise<{ lines: Line[]; period: Period | null; shown: ShownGroupBoards }> {
  const { lines: unopened, shownToUnknownViewer } = await ctx.runMutation(internal.feedback.unlockFilter.unopenedReplyOf, { ...viewer, feature: "leaderboard" });
  if (shownToUnknownViewer !== null) await ctx.scheduler.runAfter(0, internal.slack.commands.exposeOnceKnown, { ...viewer, flag: "unlocks", shown: shownToUnknownViewer });
  if (unopened !== null) return { lines: unopened, period: null, shown: noGroupBoards };
  const period = periodOf(rest);
  if (period === null) return { lines: renderLeaderboardUsage(), period: null, shown: noGroupBoards };
  const asked = { workspace: viewer.workspace, viewer: viewer.user, period };
  const groups = await ctx.runQuery(internal.leaderboard.groupBoards.groupsBoardOf, asked);
  const myGroup = await ctx.runQuery(internal.leaderboard.myGroupBoard.myGroupBoardViewOf, asked);
  const everyone = await ctx.runQuery(internal.leaderboard.totals.everyoneBoard, asked);
  const website = await ctx.runQuery(internal.website.link.websiteLinkOf, { workspace: viewer.workspace, page: { page: "leaderboard", period } });
  const boards = renderBoards(groups, myGroup, everyone, period);
  const shown = { groups: boards.some(({ board }) => board === "groups"), myGroup: boards.some(({ board }) => board === "my-group") };
  return { lines: [...boards.flatMap(({ lines }, index) => (index === 0 ? lines : [[], ...lines])), ...renderFullBoardLink(website)], period, shown };
}

const periods: readonly Period[] = ["week", "month", "all"];

function periodOf(rest: string[]): Period | null {
  if (rest.length === 0) return "week";
  const [argument] = rest;
  return rest.length === 1 && periods.includes(argument as Period) ? (argument as Period) : null;
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

function viewerOf(command: URLSearchParams): Viewer {
  return { workspace: field(command, "team_id"), user: field(command, "user_id") };
}

function field(command: URLSearchParams, name: string) {
  const value = command.get(name);
  if (value === null) throw new ReportableError(`the slash command has no ${name}`);
  return value;
}
