import type { PaginationOptions, PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { DayKey, Week } from "./allowance";
import type { MessageRef } from "./messageEvent";
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

export async function awardsGivenBefore(ctx: QueryCtx, before: number, page: PaginationOptions): Promise<PaginationResult<GivenAward>> {
  const result = await ctx.db
    .query("awards")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", before))
    .paginate(page);
  return { ...result, page: result.page.map(({ _id, giver, recipient, kudos, day }) => ({ award: _id, giver, recipient, kudos, day })) };
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
