import { v } from "convex/values";
import { internal } from "../_generated/api";
import { ReportableError, typeOf } from "../analytics/exceptions";
import { observedAction } from "../analytics/boundary";
import { textOf } from "./directory";
import { callSlack, nextRateLimitedAttempt, readSlack, retryDelayOf, slackErrorCodeOf, type SlackAnswer } from "./webApi";

type ListedChannel = { id: string; is_member?: boolean; is_archived?: boolean; is_ext_shared?: boolean; is_pending_ext_shared?: boolean };
type ChannelsPage = { channels: ListedChannel[]; response_metadata?: { next_cursor?: string } };
type ChannelCreated = { type: "channel_created"; channel?: { id?: unknown } };
type Join = { kind: "joined" } | { kind: "missed" } | { kind: "held"; forMs: number };

const channelsPerPage = "200";
const tier3JoinsPerMinute = 50;
const joinSpacingMs = Math.ceil(60_000 / tier3JoinsPerMinute) + 300;
const tier2ListsPerMinute = 20;
const listSpacingMs = Math.ceil(60_000 / tier2ListsPerMinute) + 300;
const lastPage = "";

export const joinPublicChannels = observedAction({
  args: { cursor: v.optional(v.string()), queue: v.optional(v.array(v.string())), joined: v.optional(v.number()), missed: v.optional(v.number()) },
  handler: async (ctx, { cursor, queue = [], joined = 0, missed = 0 }) => {
    const tally = { joined, missed };
    if (queue.length > 0) {
      const [channel, ...rest] = queue;
      const join = await joinOf(channel!);
      if (join.kind === "held") await ctx.scheduler.runAfter(join.forMs, internal.slack.channelJoins.joinPublicChannels, { cursor, queue, ...tally });
      else await ctx.scheduler.runAfter(joinSpacingMs, internal.slack.channelJoins.joinPublicChannels, { cursor, queue: rest, ...tallied(tally, join) });
      return;
    }
    if (cursor === lastPage) {
      console.log(`channel joins finished: joined ${joined}, missed ${missed}`);
      return;
    }
    const page = await readSlack<ChannelsPage>("conversations.list", { types: "public_channel", exclude_archived: "true", limit: channelsPerPage, ...(cursor && { cursor }) });
    if (!page.ok && page.error === "ratelimited") {
      await ctx.scheduler.runAfter(retryDelayOf(page), internal.slack.channelJoins.joinPublicChannels, { cursor, ...tally });
      return;
    }
    if (!page.ok) throw new ReportableError(`Slack conversations.list failed: ${slackErrorCodeOf(page.error)}`);
    const nextCursor = page.response_metadata?.next_cursor ?? lastPage;
    await ctx.scheduler.runAfter(listSpacingMs, internal.slack.channelJoins.joinPublicChannels, { cursor: nextCursor, queue: page.channels.filter(isJoinable).map(({ id }) => id), ...tally });
  },
});

export const joinCreatedChannel = observedAction({
  args: { channel: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { channel, attempt = 1 }) => {
    const join = await joinOf(channel);
    if (join.kind === "held") await ctx.scheduler.runAfter(join.forMs, internal.slack.channelJoins.joinCreatedChannel, { channel, attempt: nextRateLimitedAttempt(attempt, "conversations.join") });
  },
});

export function isChannelCreated(event: { type: string }): event is ChannelCreated {
  return event.type === "channel_created";
}

export function channelCreationOf(workspace: unknown, eventId: unknown, event: ChannelCreated) {
  const [team, receipt, channel] = [textOf(workspace), textOf(eventId), textOf(event.channel?.id)];
  return team === undefined || receipt === undefined || channel === undefined ? null : { workspace: team, eventId: receipt, channel };
}

function isJoinable(channel: ListedChannel) {
  return channel.is_member !== true && channel.is_archived !== true && channel.is_ext_shared !== true && channel.is_pending_ext_shared !== true;
}

async function joinOf(channel: string): Promise<Join> {
  const answer = await answerOrNothing(channel);
  if (answer === null) return { kind: "missed" };
  if (answer.ok) return { kind: "joined" };
  if (answer.error === "ratelimited") return { kind: "held", forMs: retryDelayOf(answer) };
  console.warn(`channel joins: conversations.join failed: ${slackErrorCodeOf(answer.error)}`);
  return { kind: "missed" };
}

async function answerOrNothing(channel: string): Promise<SlackAnswer | null> {
  try {
    return await callSlack("conversations.join", { channel });
  } catch (error) {
    console.warn(`channel joins: conversations.join has no answer: ${typeOf(error)}`);
    return null;
  }
}

function tallied({ joined, missed }: { joined: number; missed: number }, join: Join) {
  return join.kind === "joined" ? { joined: joined + 1, missed } : { joined, missed: missed + 1 };
}
