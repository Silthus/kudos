import { v } from "convex/values";
import { internal } from "../_generated/api";
import { ReportableError, typeOf } from "../analytics/exceptions";
import { observedAction } from "../analytics/boundary";
import { textOf } from "./directory";
import { isOffLimits, joinUnlessOffLimits, offLimitsReasonOf, type ChannelTraits, type OffLimits } from "./offLimitsChannels";
import { readSlack, retryDelayOf, slackErrorCodeOf, type SlackAnswer } from "./webApi";

type ListedChannel = ChannelTraits & { id: string; is_member?: boolean; is_archived?: boolean };
type ChannelsPage = { channels: ListedChannel[]; response_metadata?: { next_cursor?: string } };
type ChannelCreated = { type: "channel_created"; channel?: { id?: unknown } };
type Join = { kind: "joined" } | { kind: "already-in" } | { kind: "off-limits" } | { kind: "refused" } | { kind: "unanswered" } | { kind: "held"; forMs: number };

const channelsPerPage = "200";
const tier3JoinsPerMinute = 50;
const joinSpacingMs = Math.ceil(60_000 / tier3JoinsPerMinute) + 300;
const tier2ListsPerMinute = 20;
const listSpacingMs = Math.ceil(60_000 / tier2ListsPerMinute) + 300;
const lastPage = "";
const createdChannelTries = 3;
const unansweredRetryMs = 1_000;

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
    const retryInMs = retryDelayOfJoin(await joinOf(channel));
    if (retryInMs === null) return;
    if (attempt >= createdChannelTries) throw new ReportableError(`a new channel is still not joined after ${createdChannelTries} tries`);
    await ctx.scheduler.runAfter(retryInMs, internal.slack.channelJoins.joinCreatedChannel, { channel, attempt: attempt + 1 });
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
  return channel.is_member !== true && channel.is_archived !== true && offLimitsReasonOf(channel) === null;
}

async function joinOf(channel: string): Promise<Join> {
  const answer = await answerOrNothing(channel);
  if (answer === null) return { kind: "unanswered" };
  if (isOffLimits(answer)) return { kind: "off-limits" };
  if (answer.ok) return answer.warning === "already_in_channel" ? { kind: "already-in" } : { kind: "joined" };
  if (answer.error === "ratelimited") return { kind: "held", forMs: retryDelayOf(answer) };
  console.warn(`channel joins: conversations.join failed: ${slackErrorCodeOf(answer.error)}`);
  return { kind: "refused" };
}

function retryDelayOfJoin(join: Join) {
  if (join.kind === "held") return join.forMs;
  return join.kind === "unanswered" ? unansweredRetryMs : null;
}

async function answerOrNothing(channel: string): Promise<SlackAnswer | OffLimits | null> {
  try {
    return await joinUnlessOffLimits(channel);
  } catch (error) {
    console.warn(`channel joins: conversations.join has no answer: ${typeOf(error)}`);
    return null;
  }
}

function tallied({ joined, missed }: { joined: number; missed: number }, join: Join) {
  if (join.kind === "joined") return { joined: joined + 1, missed };
  return join.kind === "already-in" || join.kind === "off-limits" ? { joined, missed } : { joined, missed: missed + 1 };
}
