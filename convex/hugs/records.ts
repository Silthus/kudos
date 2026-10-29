import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { awardsOfMessage, decidedBelow, recipientsAfter, recipientsPageOf, type DecidedBelow } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export type Hug = Doc<"hugs">;

export type HugId = Doc<"hugs">["_id"];

export type HugFor = { onKudos: true } | { onKudos: false; author: MemberId };

export function hugOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, giver: MemberId) {
  return ctx.db
    .query("hugs")
    .withIndex("by_message_giver", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("giver", giver))
    .unique();
}

export function hugWithId(ctx: QueryCtx, hug: HugId) {
  return ctx.db.get(hug);
}

export function hugsInWorkspace(ctx: QueryCtx, workspace: string, page: PaginationOptions): Promise<PaginationResult<Hug>> {
  return ctx.db
    .query("hugs")
    .withIndex("by_message_giver", (q) => q.eq("workspace", workspace))
    .paginate(page);
}

export function hugsInCreationOrder(ctx: QueryCtx, page: PaginationOptions): Promise<PaginationResult<Hug>> {
  return ctx.db.query("hugs").paginate(page);
}

export type PaidHug = { hug: Hug; person: MemberId };

export async function paidHugsInCreationOrder(ctx: QueryCtx, page: PaginationOptions): Promise<PaginationResult<PaidHug>> {
  const result = await ctx.db.query("hugPeople").paginate(page);
  const paid = await Promise.all(result.page.map(async ({ hug, member }) => ({ hug: await ctx.db.get(hug), person: member })));
  return { ...result, page: paid.filter((paidHug): paidHug is PaidHug => paidHug.hug !== null) };
}

export type HugPeoplePage = { people: MemberId[]; next: string | null };

export async function hugPeoplePageOf(ctx: QueryCtx, hug: Hug, cursor: string | null, numItems: number): Promise<HugPeoplePage> {
  if (hug.author !== undefined) return { people: [hug.author], next: null };
  const { page, isDone, continueCursor } = await recipientsPageOf(ctx, hug, { cursor, numItems });
  return { people: page, next: isDone ? null : continueCursor };
}

export type HugPeopleAfter = { people: MemberId[]; last: MemberId | null };

export async function hugPeopleAfter(ctx: QueryCtx, hug: Hug, after: MemberId | null, atMost: number): Promise<HugPeopleAfter> {
  if (hug.author !== undefined) return { people: after === null ? [hug.author] : [], last: null };
  const people = await recipientsAfter(ctx, hug, after, atMost);
  return { people, last: people.length < atMost ? null : people.at(-1)! };
}

export async function hugsGivenOn(ctx: QueryCtx, giver: MemberId, day: DayKey, atMost: number): Promise<number> {
  const given = await ctx.db
    .query("hugs")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .take(atMost);
  return given.length;
}

export async function hasHuggedBefore(ctx: QueryCtx, giver: MemberId): Promise<boolean> {
  const earlier = await ctx.db
    .query("hugs")
    .withIndex("by_giver_decided", (q) => q.eq("giver", giver))
    .first();
  return earlier !== null;
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
  const current = await ctx.db
    .query("hugsReceived")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .order("desc")
    .first();
  const giver = { giver: hug.giver, at };
  const next = current === null ? { hugs: 1, emoji, at, givers: [giver] } : { hugs: current.hugs + 1, givers: newestGivers([...current.givers, giver]), ...(at >= current.at ? { emoji, at } : { emoji: current.emoji, at: current.at }) };
  const version = await ctx.db.insert("hugsReceived", { member, workspace, conversation, message, onKudos, ...next });
  if (current !== null) await ctx.db.patch(current._id, { supersededAt: (await ctx.db.get(version))!._creationTime });
}

function newestGivers(givers: PaidGiver[]): PaidGiver[] {
  return givers.toSorted((one, other) => other.at - one.at).slice(0, giversShown);
}

export type TimelineHug = { message: MessageRef; onKudos: boolean; emoji: string; at: number; created: number };

export type GivenHug = TimelineHug & { people: MemberId[] };

export type ReceivedHugs = TimelineHug & { hugs: number; givers: MemberId[] };

type PaidGiver = { giver: MemberId; at: number };

type HugsReceivedRow = Doc<"hugsReceived">;

const giversShown = 5;


export async function* hugsGivenByDecision(ctx: QueryCtx, giver: MemberId, below: DecidedBelow): AsyncGenerator<GivenHug> {
  const rows = ctx.db
    .query("hugs")
    .withIndex("by_giver_decided", (q) => decidedBelow(q.eq("giver", giver), below))
    .order("desc");
  for await (const hug of rows) yield { ...timelineHugOf(hug), people: await peopleOf(ctx, hug) };
}

export async function hugsReceivedSnapshot(ctx: QueryCtx, member: MemberId): Promise<number> {
  const newest = await ctx.db
    .query("hugsReceived")
    .withIndex("by_member", (q) => q.eq("member", member))
    .order("desc")
    .first();
  return newest?._creationTime ?? 0;
}

export async function* hugsReceivedByDecision(ctx: QueryCtx, member: MemberId, below: DecidedBelow, snapshot: number | undefined): AsyncGenerator<ReceivedHugs> {
  const versions = ctx.db
    .query("hugsReceived")
    .withIndex("by_member", (q) => decidedBelow(q.eq("member", member), below))
    .order("desc");
  for await (const version of versions) if (isLiveAt(version, snapshot)) yield receivedHugsOf(version);
}

export async function hugsOnTheMessageAsOf(ctx: QueryCtx, member: MemberId, { workspace, conversation, message }: MessageRef, at: number): Promise<number> {
  const version = await ctx.db
    .query("hugsReceived")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message).lte("_creationTime", at))
    .order("desc")
    .first();
  return version?.hugs ?? 0;
}

function isLiveAt({ _creationTime, supersededAt }: HugsReceivedRow, snapshot: number | undefined): boolean {
  if (snapshot === undefined) return supersededAt === undefined;
  return _creationTime <= snapshot && (supersededAt === undefined || supersededAt > snapshot);
}

function receivedHugsOf(row: HugsReceivedRow): ReceivedHugs {
  return { ...timelineHugOf(row), hugs: row.hugs, givers: row.givers.map(({ giver }) => giver) };
}

function timelineHugOf({ workspace, conversation, message, onKudos, emoji, at, _creationTime }: Hug | Doc<"hugsReceived">): TimelineHug {
  return { message: { workspace, conversation, message }, onKudos, emoji, at, created: _creationTime };
}

async function peopleOf(ctx: QueryCtx, hug: Hug): Promise<MemberId[]> {
  if (hug.author !== undefined) return [hug.author];
  return (await awardsOfMessage(ctx, hug)).map(({ recipient }) => recipient);
}
