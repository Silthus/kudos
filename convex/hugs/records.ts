import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import { awardsOfMessage, rangesBefore, type AtRange, type Before } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export type Hug = Doc<"hugs">;

export type HugFor = { onKudos: true } | { onKudos: false; author: MemberId };

export function hugOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, giver: MemberId) {
  return ctx.db
    .query("hugs")
    .withIndex("by_message_giver", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("giver", giver))
    .unique();
}

export async function hugsGivenOn(ctx: QueryCtx, giver: MemberId, day: DayKey, atMost: number): Promise<number> {
  const given = await ctx.db
    .query("hugs")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .take(atMost);
  return given.length;
}

export type NewHug = MessageRef & HugFor & { giver: MemberId; emoji: string; at: number; day: DayKey };

export async function insertHug(ctx: MutationCtx, hug: NewHug) {
  await ctx.db.insert("hugs", hug);
}

export async function isPaid(ctx: QueryCtx, hug: Hug, member: MemberId): Promise<boolean> {
  const paid = await ctx.db
    .query("hugPeople")
    .withIndex("by_hug_member", (q) => q.eq("hug", hug._id).eq("member", member))
    .unique();
  return paid !== null;
}

export async function insertPaid(ctx: MutationCtx, hug: Hug, member: MemberId) {
  await ctx.db.insert("hugPeople", { hug: hug._id, member, at: hug.at });
}

export async function countReceivedOnTheMessage(ctx: MutationCtx, hug: Hug, member: MemberId) {
  const { workspace, conversation, message, onKudos, emoji, at } = hug;
  const received = await ctx.db
    .query("hugsReceived")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
  if (received === null) await ctx.db.insert("hugsReceived", { member, workspace, conversation, message, onKudos, hugs: 1, emoji, at });
  else await ctx.db.patch(received._id, { hugs: received.hugs + 1, ...(at >= received.at && { emoji, at }) });
}

export type TimelineHug = { message: MessageRef; onKudos: boolean; emoji: string; at: number; created: number };

export type GivenHug = TimelineHug & { people: MemberId[] };

export type ReceivedHugs = TimelineHug & { hugs: number; givers: MemberId[] };

const giversShown = 5;

export async function* hugsGivenNewestFirst(ctx: QueryCtx, giver: MemberId, before: Before): AsyncGenerator<GivenHug> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("hugs")
      .withIndex("by_giver_at", (q) => withinRange(q.eq("giver", giver), range))
      .order("desc");
    for await (const hug of rows) yield { ...timelineHugOf(hug), people: await peopleOf(ctx, hug) };
  }
}

export async function* hugsReceivedNewestFirst(ctx: QueryCtx, member: MemberId, before: Before): AsyncGenerator<ReceivedHugs> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("hugsReceived")
      .withIndex("by_member_at", (q) => withinRange(q.eq("member", member), range))
      .order("desc");
    for await (const received of rows) yield { ...timelineHugOf(received), hugs: received.hugs, givers: await newestGiversOn(ctx, received) };
  }
}

async function newestGiversOn(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<MemberId[]> {
  const newest = await ctx.db
    .query("hugs")
    .withIndex("by_message_at", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .order("desc")
    .take(giversShown);
  return newest.map(({ giver }) => giver);
}

type AtIndex<Q> = { eq(field: "at", value: number): AtIndexCreated<Q>; lt(field: "at", value: number): Q } & Q;

type AtIndexCreated<Q> = { lt(field: "_creationTime", value: number): Q } & Q;

function withinRange<Q>(q: AtIndex<Q>, range: AtRange): Q {
  if (range.kind === "older") return range.than === undefined ? q : q.lt("at", range.than);
  return range.createdBefore === undefined ? q.eq("at", range.at) : q.eq("at", range.at).lt("_creationTime", range.createdBefore);
}

function timelineHugOf({ workspace, conversation, message, onKudos, emoji, at, _creationTime }: Hug | Doc<"hugsReceived">): TimelineHug {
  return { message: { workspace, conversation, message }, onKudos, emoji, at, created: _creationTime };
}

async function peopleOf(ctx: QueryCtx, hug: Hug): Promise<MemberId[]> {
  if (hug.author !== undefined) return [hug.author];
  return (await awardsOfMessage(ctx, hug)).map(({ recipient }) => recipient);
}
