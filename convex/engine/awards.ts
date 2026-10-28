import type { PaginationOptions, PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { allowanceDay, type DayKey, type Week } from "./allowance";
import type { Annotations, MessageRef } from "./messageEvent";
import { addToTotals } from "./totals";

export type Award = { giver: MemberId; recipient: MemberId; kudos: number };

export const awardIdValidator = v.id("awards");

export type AwardId = Id<"awards">;

export type AwardWithId = Award & { award: AwardId };

export type GivenAward = AwardWithId & { day: DayKey };

export type WeekTotals = { givenWeek: number; receivedWeek: number };

export type GivenMessage = { workspace: string; message: MessageRef; giver: MemberId; awards: Award[]; day: DayKey };

export type GivenMessagesPage = { messages: GivenMessage[]; cursor: string; isDone: boolean };

type AwardRow = Doc<"awards">;

export type DatedAward = { award: AwardId; day: DayKey; at: number; created: number; annotations: Annotations };

const dayMs = 24 * 60 * 60 * 1000;

export async function insertAwards(ctx: MutationCtx, message: MessageRef, awards: Award[], day: DayKey, at: number): Promise<AwardWithId[]> {
  const inserted: AwardWithId[] = [];
  for (const award of awards) {
    inserted.push({ award: await ctx.db.insert("awards", { ...message, ...award, day, at }), ...award });
    await addToTotals(ctx, award);
  }
  return inserted;
}

export async function weekTotals(ctx: QueryCtx, member: MemberId, week: Week): Promise<WeekTotals> {
  const given = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", member).gte("day", week.monday).lte("day", week.sunday))
    .collect();
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient", (q) => q.eq("recipient", member).gte("day", week.monday).lte("day", week.sunday))
    .collect();
  return { givenWeek: sumOf(given), receivedWeek: sumOf(received) };
}

export type WeekAward = { message: MessageRef; giver: MemberId; recipient: MemberId; at: number };

export async function awardsInWeekNewestDaysFirst(ctx: QueryCtx, member: MemberId, side: "given" | "received", { monday, sunday }: Week, atMost: number): Promise<WeekAward[]> {
  const awards =
    side === "given"
      ? ctx.db.query("awards").withIndex("by_giver", (q) => q.eq("giver", member).gte("day", monday).lte("day", sunday))
      : ctx.db.query("awards").withIndex("by_recipient", (q) => q.eq("recipient", member).gte("day", monday).lte("day", sunday));
  const newest = await awards.order("desc").take(atMost);
  return newest.map(({ workspace, conversation, message, giver, recipient, at }) => ({ message: { workspace, conversation, message }, giver, recipient, at }));
}

export type EarlierAward = { recipient: MemberId; day: DayKey; annotations: Annotations };

export async function givenEarlierInWeek(ctx: QueryCtx, giver: MemberId, { monday, sunday }: Week, before: AwardId): Promise<EarlierAward[]> {
  const cutoff = (await ctx.db.get(before))?._creationTime ?? Infinity;
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", giver).gte("day", monday).lte("day", sunday))
    .collect();
  const earlier = await withStoredAnnotations(ctx, awards.filter(({ _creationTime }) => _creationTime < cutoff));
  return earlier.map(({ award, annotations }) => ({ recipient: award.recipient, day: award.day, annotations }));
}

async function withStoredAnnotations(ctx: QueryCtx, awards: AwardRow[]): Promise<Array<{ award: AwardRow; annotations: Annotations }>> {
  const annotationsOfMessage = new Map<string, Annotations>();
  const annotated: Array<{ award: AwardRow; annotations: Annotations }> = [];
  for (const award of awards) {
    const key = messageKey(award);
    if (!annotationsOfMessage.has(key)) annotationsOfMessage.set(key, await storedAnnotationsOf(ctx, award));
    annotated.push({ award, annotations: annotationsOfMessage.get(key)! });
  }
  return annotated;
}

export async function storedAnnotationsOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<Annotations> {
  const kudosMessage = await ctx.db
    .query("kudosMessages")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
  return kudosMessage?.annotations ?? {};
}

export async function awardsGivenBefore(ctx: QueryCtx, before: number, page: PaginationOptions): Promise<PaginationResult<GivenAward>> {
  const result = await ctx.db
    .query("awards")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", before))
    .paginate(page);
  return { ...result, page: result.page.map(({ _id, giver, recipient, kudos, day }) => ({ award: _id, giver, recipient, kudos, day })) };
}

export type WorkspaceAward = GivenAward & { message: MessageRef; at: number; created: number };

export async function awardsInWorkspace(ctx: QueryCtx, workspace: string, page: PaginationOptions): Promise<PaginationResult<WorkspaceAward>> {
  const result = await ctx.db
    .query("awards")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .paginate(page);
  return {
    ...result,
    page: result.page.map(({ _id, _creationTime, conversation, message, giver, recipient, kudos, day, at }) => ({
      award: _id,
      message: { workspace, conversation, message },
      giver,
      recipient,
      kudos,
      day,
      at,
      created: _creationTime,
    })),
  };
}

export type NewestReceived = { giver: MemberId; message: MessageRef; at: number };

export async function newestReceivedBy(ctx: QueryCtx, recipient: MemberId, atMost: number): Promise<NewestReceived[]> {
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient_at", (q) => q.eq("recipient", recipient))
    .order("desc")
    .take(atMost);
  return received.map(({ giver, workspace, conversation, message, at }) => ({ giver, message: { workspace, conversation, message }, at }));
}

export async function kudosDecidedAfter(ctx: QueryCtx, recipient: MemberId, after: number, awardsAtMost: number): Promise<number> {
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient_decided", (q) => q.eq("recipient", recipient).gt("_creationTime", after))
    .take(awardsAtMost);
  return received.reduce((sum, { kudos }) => sum + kudos, 0);
}

export async function newestDecidedReceivedBy(ctx: QueryCtx, recipient: MemberId): Promise<number | null> {
  const newest = await ctx.db
    .query("awards")
    .withIndex("by_recipient_decided", (q) => q.eq("recipient", recipient))
    .order("desc")
    .first();
  return newest?._creationTime ?? null;
}

export type GivenMessageFacts = { giver: MemberId; day: DayKey; at: number };

export async function givenFactsOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<GivenMessageFacts | null> {
  const award = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .first();
  return award === null ? null : { giver: award.giver, day: award.day, at: award.at };
}

export async function awardsOfMessage(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<Array<GivenAward & { at: number }>> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .collect();
  return awards.map(({ _id, giver, recipient, kudos, day, at }) => ({ award: _id, giver, recipient, kudos, day, at }));
}

export async function authorOfGiven(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<MemberId | null> {
  const award = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .first();
  return award?.giver ?? null;
}

export async function receivedOn(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, member: MemberId): Promise<boolean> {
  const award = await ctx.db
    .query("awards")
    .withIndex("by_message_recipient", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("recipient", member))
    .first();
  return award !== null;
}

export async function recipientsPageOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, page: PaginationOptions): Promise<PaginationResult<MemberId>> {
  const result = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .paginate(page);
  return { ...result, page: result.page.map(({ recipient }) => recipient) };
}

export async function recipientsAfter(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, after: MemberId | null, atMost: number): Promise<MemberId[]> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_message_recipient", (q) => {
      const ofTheMessage = q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message);
      return after === null ? ofTheMessage : ofTheMessage.gt("recipient", after);
    })
    .take(atMost);
  return awards.map(({ recipient }) => recipient);
}

export async function dayThankedBefore(ctx: QueryCtx, award: AwardId): Promise<DayKey | null> {
  const current = await ctx.db.get(award);
  if (current === null) return null;
  const previous = await ctx.db
    .query("awards")
    .withIndex("by_giver_recipient", (q) => q.eq("giver", current.giver).eq("recipient", current.recipient).lt("_creationTime", current._creationTime))
    .order("desc")
    .first();
  return previous?.day ?? null;
}

export type EarliestAward = { award: AwardId; at: number; created: number };

export async function earliestAwardFrom(ctx: QueryCtx, giver: MemberId, recipient: MemberId): Promise<EarliestAward | null> {
  const earliest = await ctx.db
    .query("awards")
    .withIndex("by_giver_recipient", (q) => q.eq("giver", giver).eq("recipient", recipient))
    .first();
  return earliest === null ? null : { award: earliest._id, at: earliest.at, created: earliest._creationTime };
}

export type FirstAward = { message: MessageRef; at: number };

export async function firstAwardsGivenAfter(ctx: QueryCtx, giver: MemberId, after: number): Promise<FirstAward[]> {
  const firsts: FirstAward[] = [];
  for await (const row of ctx.db.query("awards").withIndex("by_giver_at", (q) => q.eq("giver", giver).gt("at", after))) {
    if ((await earliestAwardFrom(ctx, giver, row.recipient))?.award === row._id) firsts.push({ message: refOf(row), at: row.at });
  }
  return firsts;
}

export async function thankedAtOrBefore(ctx: QueryCtx, giver: MemberId, recipient: MemberId, atOrBefore: number): Promise<boolean> {
  for await (const { at } of ctx.db.query("awards").withIndex("by_giver_recipient", (q) => q.eq("giver", giver).eq("recipient", recipient))) if (at <= atOrBefore) return true;
  return false;
}

const thankedBeforeSince = -Infinity;

const repeatsReadBeforeSkipping = 16;

export async function lastThankedSince(ctx: QueryCtx, giver: MemberId, since: number, atOrBefore: number): Promise<Map<MemberId, number>> {
  const lastThanked = new Map<MemberId, number>();
  for (const recipient of await everThankedBy(ctx, giver, atOrBefore)) lastThanked.set(recipient, thankedBeforeSince);
  for (const { recipient, at } of await givenAfter(ctx, giver, since, atOrBefore)) {
    if (at > lastThanked.get(recipient)!) lastThanked.set(recipient, at);
  }
  return lastThanked;
}

async function everThankedBy(ctx: QueryCtx, giver: MemberId, atOrBefore: number): Promise<Set<MemberId>> {
  const thanked = new Set<MemberId>();
  let past: MemberId | null = null;
  do past = await thankedUntilOneRepeats(ctx, giver, past, atOrBefore, thanked);
  while (past !== null);
  return thanked;
}

async function thankedUntilOneRepeats(ctx: QueryCtx, giver: MemberId, past: MemberId | null, atOrBefore: number, thanked: Set<MemberId>): Promise<MemberId | null> {
  let repeats = 0;
  for await (const { recipient, at } of givenByRecipient(ctx, giver, past)) {
    if (!thanked.has(recipient)) {
      if (at <= atOrBefore) thanked.add(recipient);
      repeats = 0;
    } else if (++repeats === repeatsReadBeforeSkipping) return recipient;
  }
  return null;
}

function givenByRecipient(ctx: QueryCtx, giver: MemberId, past: MemberId | null) {
  return ctx.db.query("awards").withIndex("by_giver_recipient", (q) => (past === null ? q.eq("giver", giver) : q.eq("giver", giver).gt("recipient", past)));
}

function givenAfter(ctx: QueryCtx, giver: MemberId, since: number, atOrBefore: number) {
  return ctx.db
    .query("awards")
    .withIndex("by_giver_at", (q) => q.eq("giver", giver).gt("at", since).lte("at", atOrBefore))
    .collect();
}

export async function givenBetween(ctx: QueryCtx, giver: MemberId, since: number, until: number): Promise<DatedAward[]> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => {
      const from = q.eq("giver", giver).gte("day", earliestDayAt(since));
      return Number.isFinite(until) ? from.lte("day", latestDayAt(until)) : from;
    })
    .collect();
  return datedOf(ctx, awards.filter(({ at }) => at >= since && at <= until));
}

export async function givenSinceWithin(ctx: QueryCtx, giver: MemberId, since: number, mostAwards: number): Promise<DatedAward[] | null> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver_at", (q) => q.eq("giver", giver).gte("at", since))
    .take(mostAwards + 1);
  return awards.length > mostAwards ? null : datedOf(ctx, awards);
}

async function datedOf(ctx: QueryCtx, awards: AwardRow[]): Promise<DatedAward[]> {
  const sorted = awards.toSorted((one, other) => one.at - other.at);
  return (await withStoredAnnotations(ctx, sorted)).map(({ award: { _id, day, at, _creationTime }, annotations }) => ({ award: _id, day, at, created: _creationTime, annotations }));
}

function earliestDayAt(at: number): DayKey {
  return allowanceDay(at - dayMs, "UTC");
}

function latestDayAt(at: number): DayKey {
  return allowanceDay(at + dayMs, "UTC");
}

export async function awardAt(ctx: QueryCtx, award: AwardId): Promise<number | null> {
  return (await ctx.db.get(award))?.at ?? null;
}

export type LatestInAwardOrder = (awards: AwardId[]) => Promise<AwardId | null>;

export function latestInAwardOrder(ctx: QueryCtx): LatestInAwardOrder {
  const created = new Map<AwardId, number | null>();
  const creationOf = async (award: AwardId) => {
    if (!created.has(award)) created.set(award, (await ctx.db.get(award))?._creationTime ?? null);
    return created.get(award)!;
  };
  return async (awards) => {
    let latest: { award: AwardId; at: number } | null = null;
    for (const award of awards) {
      const at = await creationOf(award);
      if (at !== null && (latest === null || at > latest.at)) latest = { award, at };
    }
    return latest?.award ?? null;
  };
}

export async function messageOfAward(ctx: QueryCtx, award: AwardId): Promise<MessageRef | null> {
  const row = await ctx.db.get(award);
  return row === null ? null : { workspace: row.workspace, conversation: row.conversation, message: row.message };
}

export async function oldestAwardGivenBy(ctx: QueryCtx, giver: MemberId): Promise<{ award: AwardId; decided: number } | null> {
  const oldest = await ctx.db
    .query("awards")
    .withIndex("by_giver_decided", (q) => q.eq("giver", giver))
    .first();
  return oldest === null ? null : { award: oldest._id, decided: oldest._creationTime };
}

export async function firstDecidedOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<number | null> {
  const first = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .first();
  return first?._creationTime ?? null;
}

export async function hasGivenAnAward(ctx: QueryCtx, giver: MemberId): Promise<boolean> {
  const any = await ctx.db
    .query("awards")
    .withIndex("by_giver_decided", (q) => q.eq("giver", giver))
    .first();
  return any !== null;
}

export async function hasReceivedAnAward(ctx: QueryCtx, recipient: MemberId): Promise<boolean> {
  const any = await ctx.db
    .query("awards")
    .withIndex("by_recipient_decided", (q) => q.eq("recipient", recipient))
    .first();
  return any !== null;
}

export async function firstThanksOf(ctx: QueryCtx, giver: MemberId): Promise<number[]> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", giver))
    .collect();
  const thanked = new Set<MemberId>();
  const firsts: number[] = [];
  for (const { recipient, at } of awards.sort((one, other) => one._creationTime - other._creationTime)) {
    if (!thanked.has(recipient)) firsts.push(at);
    thanked.add(recipient);
  }
  return firsts;
}

export async function lastThankedBefore(ctx: QueryCtx, awards: AwardWithId[]): Promise<Map<AwardId, number | null>> {
  const lastThanked = new Map<AwardId, number | null>();
  for (const { award, giver, recipient } of awards) {
    const toRecipient = await ctx.db
      .query("awards")
      .withIndex("by_giver_recipient", (q) => q.eq("giver", giver).eq("recipient", recipient))
      .collect();
    const current = toRecipient.find(({ _id }) => _id === award);
    if (current === undefined) continue;
    const earlier = toRecipient.filter(({ _creationTime }) => _creationTime < current._creationTime);
    lastThanked.set(award, earlier.length === 0 ? null : Math.max(...earlier.map(({ at }) => at)));
  }
  return lastThanked;
}

function sumOf(awards: Array<{ kudos: number }>) {
  return awards.reduce((sum, award) => sum + award.kudos, 0);
}

export async function givenMessagesInAwardOrder(ctx: QueryCtx, cursor: string | null, pageSize: number): Promise<GivenMessagesPage> {
  const page = await ctx.db.query("awards").paginate({ cursor, numItems: pageSize });
  const messages: GivenMessage[] = [];
  for (const award of firstAwardOfEachMessage(page.page)) messages.push(await givenMessageOf(ctx, award));
  return { messages, cursor: page.continueCursor, isDone: page.isDone };
}

function firstAwardOfEachMessage(awards: AwardRow[]) {
  const seen = new Set<string>();
  return awards.filter((award) => {
    const key = messageKey(award);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function givenMessageOf(ctx: QueryCtx, first: AwardRow): Promise<GivenMessage> {
  const { workspace, conversation, message, giver, day } = first;
  const awardsOfMessage = await ctx.db
    .query("awards")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .collect();
  const awards = awardsOfMessage.map(({ recipient, kudos }) => ({ giver, recipient, kudos }));
  return { workspace, message: { workspace, conversation, message }, giver, awards, day };
}

function messageKey({ workspace, conversation, message }: Pick<AwardRow, "workspace" | "conversation" | "message">) {
  return JSON.stringify([workspace, conversation, message]);
}

export type Before = { at: number; created: number };

export const fromTheNewest: Before = { at: Infinity, created: Infinity };

export type ReceivedAward = { award: AwardId; message: MessageRef; giver: MemberId; kudos: number; at: number; created: number };

export type MessageAward = { award: AwardId; recipient: MemberId; kudos: number };

export type GivenMessageAwards = { first: AwardId; message: MessageRef; awards: MessageAward[]; at: number; created: number };

export type AtRange = { kind: "instant"; at: number; createdBefore?: number } | { kind: "older"; than?: number };

export async function* awardsReceivedNewestFirst(ctx: QueryCtx, recipient: MemberId, before: Before): AsyncGenerator<ReceivedAward> {
  for (const range of rangesBefore(before)) {
    const rows = ctx.db
      .query("awards")
      .withIndex("by_recipient_at", (q) => {
        const received = q.eq("recipient", recipient);
        if (range.kind === "older") return range.than === undefined ? received : received.lt("at", range.than);
        return range.createdBefore === undefined ? received.eq("at", range.at) : received.eq("at", range.at).lt("_creationTime", range.createdBefore);
      })
      .order("desc");
    for await (const row of rows) yield receivedAwardOf(row);
  }
}

function receivedAwardOf(row: AwardRow): ReceivedAward {
  return { award: row._id, message: refOf(row), giver: row.giver, kudos: row.kudos, at: row.at, created: row._creationTime };
}

export function messagesGivenNewestFirst(ctx: QueryCtx, giver: MemberId, before: Before): AsyncGenerator<GivenMessageAwards> {
  return byMessage(awardsGivenNewestFirst(ctx, giver, before));
}

async function* byMessage(rows: AsyncIterable<AwardRow>): AsyncGenerator<GivenMessageAwards> {
  let current: GivenMessageAwards | null = null;
  for await (const row of rows) {
    if (current !== null && messageKey(row) !== messageKey(current.message)) {
      yield current;
      current = null;
    }
    current ??= { first: row._id, message: refOf(row), awards: [], at: row.at, created: row._creationTime };
    current.awards.unshift({ award: row._id, recipient: row.recipient, kudos: row.kudos });
    current.first = row._id;
    current.created = row._creationTime;
  }
  if (current !== null) yield current;
}

async function* awardsGivenNewestFirst(ctx: QueryCtx, giver: MemberId, before: Before): AsyncGenerator<AwardRow> {
  for (const range of rangesBefore(before)) {
    yield* ctx.db
      .query("awards")
      .withIndex("by_giver_at", (q) => {
        const given = q.eq("giver", giver);
        if (range.kind === "older") return range.than === undefined ? given : given.lt("at", range.than);
        return range.createdBefore === undefined ? given.eq("at", range.at) : given.eq("at", range.at).lt("_creationTime", range.createdBefore);
      })
      .order("desc");
  }
}

export type DecidedBelow = { decided: number; inclusive: boolean; above?: number };

export const fromTheNewestDecided: DecidedBelow = { decided: Infinity, inclusive: true };

type UpperBounded<Q> = { lt(field: "_creationTime", value: number): Q; lte(field: "_creationTime", value: number): Q } & Q;

type DecidedIndex<Q> = { gt(field: "_creationTime", value: number): UpperBounded<Q> } & UpperBounded<Q>;

export function decidedBelow<Q>(q: DecidedIndex<Q>, { decided, inclusive, above }: DecidedBelow): Q {
  const bounded = above === undefined ? q : q.gt("_creationTime", above);
  if (decided === Infinity) return bounded;
  return inclusive ? bounded.lte("_creationTime", decided) : bounded.lt("_creationTime", decided);
}

export async function* awardsReceivedByDecision(ctx: QueryCtx, recipient: MemberId, below: DecidedBelow): AsyncGenerator<ReceivedAward> {
  const rows = ctx.db
    .query("awards")
    .withIndex("by_recipient_decided", (q) => decidedBelow(q.eq("recipient", recipient), below))
    .order("desc");
  for await (const row of rows) yield receivedAwardOf(row);
}

export type AnnotatedGivenMessage = GivenMessageAwards & { annotations: Annotations };

export async function messagesGivenDecidedAfter(ctx: QueryCtx, giver: MemberId, after: number, mostAwards: number): Promise<AnnotatedGivenMessage[] | null> {
  const given: AnnotatedGivenMessage[] = [];
  let awards = 0;
  for await (const message of messagesGivenByDecision(ctx, giver, { ...fromTheNewestDecided, above: after })) {
    awards += message.awards.length;
    if (awards > mostAwards) return null;
    given.push({ ...message, annotations: await storedAnnotationsOf(ctx, message.message) });
  }
  return given;
}

export function messagesGivenByDecision(ctx: QueryCtx, giver: MemberId, below: DecidedBelow): AsyncGenerator<GivenMessageAwards> {
  return byMessage(
    ctx.db
      .query("awards")
      .withIndex("by_giver_decided", (q) => decidedBelow(q.eq("giver", giver), below))
      .order("desc"),
  );
}

export function rangesBefore({ at, created }: Before): AtRange[] {
  if (at === Infinity) return [{ kind: "older" }];
  const sameInstant: AtRange[] = created === -Infinity ? [] : [{ kind: "instant", at, ...(created !== Infinity && { createdBefore: created }) }];
  return [...sameInstant, { kind: "older", than: at }];
}

function refOf({ workspace, conversation, message }: Pick<AwardRow, "workspace" | "conversation" | "message">): MessageRef {
  return { workspace, conversation, message };
}
