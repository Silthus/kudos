import type { QueryCtx } from "../_generated/server";
import type { AwardId } from "../engine/awards";
import { threadRootOf } from "../engine/engine";
import { wordsOf } from "../engine/kudosText";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { gateRecordedWith } from "../progression/effects";
import { permalinkOf } from "../slack/permalink";
import { nameless, teammateOf } from "../website/faces";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { nameAndPictureOf, currentMemberOfUser, type MemberId } from "../workspace/directory";
import { workspaceUrlOf } from "../workspace/url";
import { userGroupHandleOf } from "../workspace/userGroups";
import type { Channel, Message, Person, Segment } from "./entries";

export type KudosFacts = { channel: Channel; saidWhy: boolean | null; permalink: string | null; message: Message };

const unknownChannel: Channel = { visibility: "unknown" };
const unknownGroupHandle = "group";
const broadcastRanges = ["here", "channel", "everyone"] as const;

export const mentionLookupsPerPage = 2_000;

type PersonMentioned = Extract<Segment, { kind: "person" }>;

export type Mentions = {
  person: (workspace: string, user: string) => Promise<PersonMentioned>;
  groupHandle: (workspace: string, group: string) => Promise<string>;
  emojiImage: (workspace: string, name: string) => Promise<string | undefined>;
};

export type PeopleMentioned = "named" | "linked";

export function mentionsOfOnePage(ctx: QueryCtx, lookupsAtMost = mentionLookupsPerPage, people: PeopleMentioned = "named"): Mentions {
  const looked = new Map<string, Promise<unknown>>();
  const once = <Found>(key: string, lookUp: () => Promise<Found | undefined>): Promise<Found | undefined> => {
    const known = looked.get(key);
    if (known !== undefined) return known as Promise<Found | undefined>;
    if (looked.size >= lookupsAtMost) return Promise.resolve(undefined);
    const answer = lookUp();
    looked.set(key, answer);
    return answer;
  };
  return {
    person: async (workspace, user) => personMentionedAs(await once(`person ${workspace} ${user}`, () => currentMemberOfUser(ctx, workspace, user)), people),
    groupHandle: async (workspace, group) => (await once(`group ${workspace} ${group}`, () => userGroupHandleOf(ctx, workspace, group))) ?? unknownGroupHandle,
    emojiImage: (workspace, name) => once(`emoji ${workspace} ${name}`, () => customEmojiImageOf(ctx, workspace, name)),
  };
}

function personMentionedAs(known: { member: MemberId; name: string | undefined } | undefined, people: PeopleMentioned): PersonMentioned {
  const name = known?.name ?? nameless;
  return known === undefined || people === "named" ? { kind: "person", name } : { kind: "person", name, person: known.member };
}

export async function kudosFactsOf(ctx: QueryCtx, mentions: Mentions, ref: MessageRef, first: AwardId): Promise<KudosFacts> {
  const [{ channel, message }, gate, permalink] = await Promise.all([wordsAndChannelOf(ctx, mentions, ref), gateRecordedWith(ctx, first), permalinkOfMessage(ctx, ref)]);
  return { channel, saidWhy: gate?.thoughtful ?? null, permalink, message };
}

export async function personOf(ctx: QueryCtx, member: MemberId): Promise<Person> {
  const { name, picture } = await nameAndPictureOf(ctx, member);
  return teammateOf(name, picture);
}

export async function kudosWordsOf(ctx: QueryCtx, mentions: Mentions, ref: MessageRef): Promise<Message> {
  return (await wordsAndChannelOf(ctx, mentions, ref)).message;
}

async function wordsAndChannelOf(ctx: QueryCtx, mentions: Mentions, ref: MessageRef): Promise<{ channel: Channel; message: Message }> {
  const text = await wordsOf(ctx, ref);
  if (text.kind === "unavailable") return { channel: unknownChannel, message: { kind: "unavailable", reason: text.reason } };
  return { channel: { visibility: text.visibility }, message: { kind: "text", segments: await readableSegmentsOf(mentions, ref.workspace, text.segments), edited: text.edited } };
}

export function readableSegmentsOf(mentions: Mentions, workspace: string, segments: WordSegment[]): Promise<Segment[]> {
  return Promise.all(segments.map((segment) => readableSegmentOf(mentions, workspace, segment)));
}

async function readableSegmentOf(mentions: Mentions, workspace: string, segment: WordSegment): Promise<Segment> {
  switch (segment.kind) {
    case "person":
      return mentions.person(workspace, segment.user);
    case "group":
      return { kind: "group", handle: await mentions.groupHandle(workspace, segment.group) };
    case "broadcast":
      return broadcastSegmentOf(segment.range);
    case "emoji":
      return segment.unicode === undefined ? withImageOf(mentions, workspace, segment) : segment;
    default:
      return segment;
  }
}

async function withImageOf(mentions: Mentions, workspace: string, segment: Extract<WordSegment, { kind: "emoji" }>): Promise<Segment> {
  const image = await mentions.emojiImage(workspace, segment.name);
  return image === undefined ? segment : { ...segment, image };
}

function broadcastSegmentOf(range: string): Segment {
  const known = broadcastRanges.find((broadcast) => broadcast === range);
  return known === undefined ? { kind: "text", text: `@${range}` } : { kind: "broadcast", range: known };
}

export async function permalinkOfMessage(ctx: QueryCtx, ref: MessageRef): Promise<string | null> {
  const workspaceUrl = await workspaceUrlOf(ctx, ref.workspace);
  return workspaceUrl === null ? null : permalinkOf(workspaceUrl, ref, await threadRootOf(ctx, ref));
}
