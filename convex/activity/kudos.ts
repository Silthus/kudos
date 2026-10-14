import type { QueryCtx } from "../_generated/server";
import type { AwardId } from "../engine/awards";
import { threadRootOf } from "../engine/engine";
import { wordsOf } from "../engine/kudosText";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { gateRecordedWith } from "../progression/effects";
import { permalinkOf } from "../slack/permalink";
import { teammateOf } from "../website/faces";
import { displayNameOf, displayNameOfUser, type MemberId } from "../workspace/directory";
import { workspaceUrlOf } from "../workspace/url";
import { userGroupHandleOf } from "../workspace/userGroups";
import type { Channel, Message, Person, Segment } from "./entries";

export type KudosFacts = { channel: Channel; saidWhy: boolean | null; permalink: string | null; message: Message };

const privateChannel: Channel = { visibility: "private" };
const unknownGroupHandle = "group";
const broadcastRanges = ["here", "channel", "everyone"] as const;

export async function kudosFactsOf(ctx: QueryCtx, ref: MessageRef, first: AwardId): Promise<KudosFacts> {
  const [{ channel, message }, gate, permalink] = await Promise.all([wordsAndChannelOf(ctx, ref), gateRecordedWith(ctx, first), permalinkOfMessage(ctx, ref)]);
  return { channel, saidWhy: gate?.thoughtful ?? null, permalink, message };
}

export async function personOf(ctx: QueryCtx, member: MemberId): Promise<Person> {
  return teammateOf(await displayNameOf(ctx, member));
}

async function wordsAndChannelOf(ctx: QueryCtx, ref: MessageRef): Promise<{ channel: Channel; message: Message }> {
  const text = await wordsOf(ctx, ref);
  if (text.kind === "unavailable") return { channel: privateChannel, message: { kind: "unavailable", reason: text.reason } };
  const channel: Channel = { visibility: text.visibility === "public" ? "public" : "private" };
  const segments = await Promise.all(text.segments.map((segment) => readableSegmentOf(ctx, ref.workspace, segment)));
  return { channel, message: { kind: "text", segments, edited: text.edited } };
}

async function readableSegmentOf(ctx: QueryCtx, workspace: string, segment: WordSegment): Promise<Segment> {
  switch (segment.kind) {
    case "person":
      return { kind: "person", name: teammateOf(await displayNameOfUser(ctx, workspace, segment.user)).name };
    case "group":
      return { kind: "group", handle: (await userGroupHandleOf(ctx, workspace, segment.group)) ?? unknownGroupHandle };
    case "broadcast":
      return broadcastSegmentOf(segment.range);
    default:
      return segment;
  }
}

function broadcastSegmentOf(range: string): Segment {
  const known = broadcastRanges.find((broadcast) => broadcast === range);
  return known === undefined ? { kind: "text", text: `@${range}` } : { kind: "broadcast", range: known };
}

async function permalinkOfMessage(ctx: QueryCtx, ref: MessageRef): Promise<string | null> {
  const workspaceUrl = await workspaceUrlOf(ctx, ref.workspace);
  return workspaceUrl === null ? null : permalinkOf(workspaceUrl, ref, await threadRootOf(ctx, ref));
}
