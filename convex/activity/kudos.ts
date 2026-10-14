import type { QueryCtx } from "../_generated/server";
import type { AwardId } from "../engine/awards";
import { threadRootOf } from "../engine/engine";
import { wordsOf } from "../engine/kudosText";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { gateRecordedWith } from "../progression/effects";
import { permalinkOf } from "../slack/permalink";
import { nameless, teammateOf } from "../website/faces";
import { displayNameOf, displayNameOfUser, type MemberId } from "../workspace/directory";
import { workspaceUrlOf } from "../workspace/url";
import { userGroupHandleOf } from "../workspace/userGroups";
import type { Channel, Message, Person, Segment } from "./entries";

export type KudosFacts = { channel: Channel; saidWhy: boolean | null; permalink: string | null; message: Message };

const privateChannel: Channel = { visibility: "private" };
const unknownGroupHandle = "group";
const broadcastRanges = ["here", "channel", "everyone"] as const;

const mentionLookupsPerPage = 2_000;

export type Mentions = { personName: (workspace: string, user: string) => Promise<string>; groupHandle: (workspace: string, group: string) => Promise<string> };

export function mentionsOfOnePage(ctx: QueryCtx): Mentions {
  const looked = new Map<string, Promise<string>>();
  const once = (key: string, fallback: string, lookUp: () => Promise<string | undefined>) => {
    const known = looked.get(key);
    if (known !== undefined) return known;
    if (looked.size >= mentionLookupsPerPage) return Promise.resolve(fallback);
    const answer = lookUp().then((found) => found ?? fallback);
    looked.set(key, answer);
    return answer;
  };
  return {
    personName: (workspace, user) => once(`person ${workspace} ${user}`, nameless, () => displayNameOfUser(ctx, workspace, user)),
    groupHandle: (workspace, group) => once(`group ${workspace} ${group}`, unknownGroupHandle, () => userGroupHandleOf(ctx, workspace, group)),
  };
}

export async function kudosFactsOf(ctx: QueryCtx, mentions: Mentions, ref: MessageRef, first: AwardId): Promise<KudosFacts> {
  const [{ channel, message }, gate, permalink] = await Promise.all([wordsAndChannelOf(ctx, mentions, ref), gateRecordedWith(ctx, first), permalinkOfMessage(ctx, ref)]);
  return { channel, saidWhy: gate?.thoughtful ?? null, permalink, message };
}

export async function personOf(ctx: QueryCtx, member: MemberId): Promise<Person> {
  return teammateOf(await displayNameOf(ctx, member));
}

async function wordsAndChannelOf(ctx: QueryCtx, mentions: Mentions, ref: MessageRef): Promise<{ channel: Channel; message: Message }> {
  const text = await wordsOf(ctx, ref);
  if (text.kind === "unavailable") return { channel: privateChannel, message: { kind: "unavailable", reason: text.reason } };
  const channel: Channel = { visibility: text.visibility === "public" ? "public" : "private" };
  return { channel, message: { kind: "text", segments: await readableSegmentsOf(mentions, ref.workspace, text.segments), edited: text.edited } };
}

export function readableSegmentsOf(mentions: Mentions, workspace: string, segments: WordSegment[]): Promise<Segment[]> {
  return Promise.all(segments.map((segment) => readableSegmentOf(mentions, workspace, segment)));
}

async function readableSegmentOf(mentions: Mentions, workspace: string, segment: WordSegment): Promise<Segment> {
  switch (segment.kind) {
    case "person":
      return { kind: "person", name: await mentions.personName(workspace, segment.user) };
    case "group":
      return { kind: "group", handle: await mentions.groupHandle(workspace, segment.group) };
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

export async function permalinkOfMessage(ctx: QueryCtx, ref: MessageRef): Promise<string | null> {
  const workspaceUrl = await workspaceUrlOf(ctx, ref.workspace);
  return workspaceUrl === null ? null : permalinkOf(workspaceUrl, ref, await threadRootOf(ctx, ref));
}
