import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import { awardsOfMessage, rangesBefore, type AtRange, type Before } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export type Star = Doc<"stars">;

export type StarFor = { onKudos: true } | { onKudos: false; author: MemberId };

export function starOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, giver: MemberId) {
  return ctx.db
    .query("stars")
    .withIndex("by_message_giver", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("giver", giver))
    .unique();
}

export async function starsGivenOn(ctx: QueryCtx, giver: MemberId, day: DayKey, atMost: number): Promise<number> {
  const given = await ctx.db
    .query("stars")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .take(atMost);
  return given.length;
}

export async function insertStar(ctx: MutationCtx, star: MessageRef & StarFor & { giver: MemberId; at: number; day: DayKey }) {
  await ctx.db.insert("stars", star);
}

export async function isPaid(ctx: QueryCtx, star: Star, member: MemberId): Promise<boolean> {
  const paid = await ctx.db
    .query("starPeople")
    .withIndex("by_star_member", (q) => q.eq("star", star._id).eq("member", member))
    .unique();
  return paid !== null;
}

export async function insertPaid(ctx: MutationCtx, star: Star, member: MemberId) {
  await ctx.db.insert("starPeople", { star: star._id, member, at: star.at });
}

export type TimelineStar = { message: MessageRef; giver: MemberId; onKudos: boolean; at: number; created: number };

export type GivenStar = TimelineStar & { people: MemberId[] };

export async function* starsGivenNewestFirst(ctx: QueryCtx, giver: MemberId, before: Before): AsyncGenerator<GivenStar> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("stars")
      .withIndex("by_giver_at", (q) => withinRange(q.eq("giver", giver), range))
      .order("desc");
    for await (const star of rows) yield { ...timelineStarOf(star, star._creationTime), people: await peopleOf(ctx, star) };
  }
}

export async function* starsReceivedNewestFirst(ctx: QueryCtx, member: MemberId, before: Before): AsyncGenerator<TimelineStar> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("starPeople")
      .withIndex("by_member_at", (q) => withinRange(q.eq("member", member), range))
      .order("desc");
    for await (const { star, _creationTime } of rows) {
      const received = await ctx.db.get(star);
      if (received !== null) yield timelineStarOf(received, _creationTime);
    }
  }
}

type AtIndex<Q> = { eq(field: "at", value: number): AtIndexCreated<Q>; lt(field: "at", value: number): Q } & Q;

type AtIndexCreated<Q> = { lt(field: "_creationTime", value: number): Q } & Q;

function withinRange<Q>(q: AtIndex<Q>, range: AtRange): Q {
  if (range.kind === "older") return range.than === undefined ? q : q.lt("at", range.than);
  return range.createdBefore === undefined ? q.eq("at", range.at) : q.eq("at", range.at).lt("_creationTime", range.createdBefore);
}

function timelineStarOf({ workspace, conversation, message, giver, onKudos, at }: Star, created: number): TimelineStar {
  return { message: { workspace, conversation, message }, giver, onKudos, at, created };
}

async function peopleOf(ctx: QueryCtx, star: Star): Promise<MemberId[]> {
  if (star.author !== undefined) return [star.author];
  return (await awardsOfMessage(ctx, star)).map(({ recipient }) => recipient);
}
