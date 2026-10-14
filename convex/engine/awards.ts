import type { PaginationOptions, PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { DayKey, Week } from "./allowance";
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

export type EarlierAward = { recipient: MemberId; day: DayKey; annotations: Annotations };

export async function givenEarlierInWeek(ctx: QueryCtx, giver: MemberId, { monday, sunday }: Week, before: AwardId): Promise<EarlierAward[]> {
  const cutoff = (await ctx.db.get(before))?._creationTime ?? Infinity;
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", giver).gte("day", monday).lte("day", sunday))
    .collect();
  const annotationsOfMessage = new Map<string, Annotations>();
  const earlier: EarlierAward[] = [];
  for (const award of awards.filter(({ _creationTime }) => _creationTime < cutoff)) {
    const key = messageKey(award);
    if (!annotationsOfMessage.has(key)) annotationsOfMessage.set(key, await storedAnnotationsOf(ctx, award));
    earlier.push({ recipient: award.recipient, day: award.day, annotations: annotationsOfMessage.get(key)! });
  }
  return earlier;
}

async function storedAnnotationsOf(ctx: QueryCtx, { workspace, conversation, message }: AwardRow): Promise<Annotations> {
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

export async function awardsInWorkspace(ctx: QueryCtx, workspace: string, page: PaginationOptions): Promise<PaginationResult<AwardWithId & { at: number }>> {
  const result = await ctx.db
    .query("awards")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .paginate(page);
  return { ...result, page: result.page.map(({ _id, giver, recipient, kudos, at }) => ({ award: _id, giver, recipient, kudos, at })) };
}

export async function lastThankedBy(ctx: QueryCtx, giver: MemberId, atOrBefore: number): Promise<Map<MemberId, number>> {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", giver))
    .collect();
  const lastThanked = new Map<MemberId, number>();
  for (const { recipient, at } of awards) {
    if (at <= atOrBefore && at > (lastThanked.get(recipient) ?? -Infinity)) lastThanked.set(recipient, at);
  }
  return lastThanked;
}

export async function awardAt(ctx: QueryCtx, award: AwardId): Promise<number | null> {
  return (await ctx.db.get(award))?.at ?? null;
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

function messageKey({ workspace, conversation, message }: AwardRow) {
  return JSON.stringify([workspace, conversation, message]);
}
