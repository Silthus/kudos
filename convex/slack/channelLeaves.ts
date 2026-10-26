import { v } from "convex/values";
import { internal } from "../_generated/api";
import { ReportableError, typeOf } from "../analytics/exceptions";
import { observedAction } from "../analytics/boundary";
import { textOf } from "./directory";
import type { EventCallback } from "./normalize";
import { offLimitsReasonOf, type ChannelTraits } from "./offLimitsChannels";
import { callSlack, readSlack, retryDelayOf, slackErrorCodeOf, type SlackAnswer } from "./webApi";

type JoinedChannel = ChannelTraits & { id: string };
type JoinedChannelsPage = { channels: JoinedChannel[]; response_metadata?: { next_cursor?: string } };
type ChannelInfo = { channel: ChannelTraits };
type Leave = { kind: "left" } | { kind: "kept" } | { kind: "missed" } | { kind: "held"; forMs: number };
type LeaveAnswer = SlackAnswer & { not_in_channel?: boolean };
type ChannelEvent =
  | { type: "channel_shared"; channel?: unknown }
  | { type: "channel_rename" | "group_rename"; channel?: { id?: unknown } }
  | { type: "member_joined_channel"; channel?: unknown; user?: unknown };
type ChannelEventEnvelope = EventCallback & { event: ChannelEvent; authorizations?: Array<{ user_id?: string; is_bot?: boolean }> };

const channelsPerPage = "200";
const tier3CallsPerMinute = 50;
const callSpacingMs = Math.ceil(60_000 / tier3CallsPerMinute) + 300;
const lastPage = "";
const checkTries = 3;
const channelEventTypes: ReadonlySet<string> = new Set(["channel_shared", "channel_rename", "group_rename", "member_joined_channel"]);
const alreadyOut: ReadonlySet<string> = new Set(["not_in_channel", "channel_not_found"]);

export const leaveOffLimitsChannels = observedAction({
  args: { cursor: v.optional(v.string()), queue: v.optional(v.array(v.string())), left: v.optional(v.number()), missed: v.optional(v.number()) },
  handler: async (ctx, { cursor, queue = [], left = 0, missed = 0 }) => {
    const tally = { left, missed };
    if (cursor !== lastPage) {
      const page = await readSlack<JoinedChannelsPage>("users.conversations", { types: "public_channel,private_channel", exclude_archived: "true", limit: channelsPerPage, ...(cursor && { cursor }) });
      if (!page.ok && page.error === "ratelimited") {
        await ctx.scheduler.runAfter(retryDelayOf(page), internal.slack.channelLeaves.leaveOffLimitsChannels, { cursor, queue, ...tally });
        return;
      }
      if (!page.ok) throw new ReportableError(`Slack users.conversations failed: ${slackErrorCodeOf(page.error)}`);
      const offLimits = page.channels.filter((channel) => offLimitsReasonOf(channel) !== null).map(({ id }) => id);
      await ctx.scheduler.runAfter(callSpacingMs, internal.slack.channelLeaves.leaveOffLimitsChannels, { cursor: page.response_metadata?.next_cursor ?? lastPage, queue: [...queue, ...offLimits], ...tally });
      return;
    }
    const [channel, ...rest] = queue;
    if (channel === undefined) {
      console.log(`channel leaves finished: left ${left}, missed ${missed}`);
      return;
    }
    const leave = await leaveIfStillOffLimits(channel);
    if (leave.kind === "held") await ctx.scheduler.runAfter(leave.forMs, internal.slack.channelLeaves.leaveOffLimitsChannels, { cursor, queue, ...tally });
    else await ctx.scheduler.runAfter(callSpacingMs, internal.slack.channelLeaves.leaveOffLimitsChannels, { cursor, queue: rest, ...tallied(tally, leave) });
  },
});

export const leaveIfOffLimits = observedAction({
  args: { channel: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { channel, attempt = 1 }) => {
    const leave = await leaveIfStillOffLimits(channel);
    if (leave.kind !== "held") return;
    if (attempt >= checkTries) throw new ReportableError(`a channel is still unchecked after ${checkTries} tries`);
    await ctx.scheduler.runAfter(leave.forMs, internal.slack.channelLeaves.leaveIfOffLimits, { channel, attempt: attempt + 1 });
  },
});

export function isChannelEvent(envelope: EventCallback): envelope is ChannelEventEnvelope {
  return channelEventTypes.has(envelope.event.type);
}

export function channelCheckOf(envelope: ChannelEventEnvelope) {
  const [workspace, eventId, channel] = [textOf(envelope.team_id), textOf(envelope.event_id), channelOf(envelope)];
  return workspace === undefined || eventId === undefined || channel === undefined ? null : { workspace, eventId, channel };
}

function channelOf({ event, authorizations }: ChannelEventEnvelope) {
  if (event.type === "channel_rename" || event.type === "group_rename") return textOf(event.channel?.id);
  if (event.type === "member_joined_channel" && event.user !== appBotUserOf(authorizations)) return undefined;
  return textOf(event.channel);
}

function appBotUserOf(authorizations: ChannelEventEnvelope["authorizations"]) {
  return authorizations?.find((authorization) => authorization.is_bot === true)?.user_id;
}

async function leaveIfStillOffLimits(channel: string): Promise<Leave> {
  const info = await readSlack<ChannelInfo>("conversations.info", { channel });
  if (!info.ok && info.error === "ratelimited") return { kind: "held", forMs: retryDelayOf(info) };
  if (!info.ok) return missedAfter("conversations.info", info.error);
  return offLimitsReasonOf(info.channel) === null ? { kind: "kept" } : leaveOf(channel);
}

async function leaveOf(channel: string): Promise<Leave> {
  try {
    const answer: LeaveAnswer = await callSlack("conversations.leave", { channel });
    if (answer.ok || answer.not_in_channel === true || alreadyOut.has(answer.error)) return { kind: "left" };
    if (answer.error === "ratelimited") return { kind: "held", forMs: retryDelayOf(answer) };
    return missedAfter("conversations.leave", answer.error);
  } catch (error) {
    console.warn(`channel leaves: conversations.leave has no answer: ${typeOf(error)}`);
    return { kind: "missed" };
  }
}

function missedAfter(method: string, error: string): Leave {
  console.warn(`channel leaves: ${method} failed: ${slackErrorCodeOf(error)}`);
  return { kind: "missed" };
}

function tallied({ left, missed }: { left: number; missed: number }, leave: Leave) {
  if (leave.kind === "left") return { left: left + 1, missed };
  return leave.kind === "kept" ? { left, missed } : { left, missed: missed + 1 };
}
