import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import { board, type BoardView, type Entry } from "./board";

type Period = string;

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }) => {
    if (await wasCounted(ctx, event.message)) return;
    await ctx.db.insert("countedKudosGiven", event.message);
    const kudos = kudosGivenIn(event);
    await addToDay(ctx, event, kudos);
    for (const period of periodsOf(event.day)) await addToPeriod(ctx, event, period, kudos);
  },
});

export const everyoneBoard = internalQuery({
  args: { workspace: v.string(), viewer: v.string() },
  handler: async (ctx, { workspace, viewer }): Promise<BoardView> => {
    const facts = await lookup(ctx, workspace, viewer);
    const today = allowanceDay(Date.now(), facts?.kind === "member" ? facts.timeZone : undefined);
    return board(await entriesOf(ctx, workspace, weekPeriodOf(today)), viewer);
  },
});

function kudosGivenIn(event: KudosGivenEvent) {
  return event.awards.reduce((sum, award) => sum + award.kudos, 0);
}

function periodsOf(day: DayKey): Period[] {
  return [weekPeriodOf(day), `month:${day.slice(0, 7)}`, "all"];
}

function weekPeriodOf(day: DayKey): Period {
  return `week:${weekOf(day).monday}`;
}

async function entriesOf(ctx: QueryCtx, workspace: string, period: Period): Promise<Entry[]> {
  const totals = await ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
  const entries = await Promise.all(totals.map((total) => entryOf(ctx, total.member, total.kudos)));
  return entries.filter((entry) => entry !== null);
}

async function entryOf(ctx: QueryCtx, member: MemberId, kudos: number): Promise<Entry | null> {
  const row = await ctx.db.get(member);
  if (row?.kind !== "member") return null;
  return { id: row.user, name: row.name ?? row.user, value: kudos };
}

async function wasCounted(ctx: QueryCtx, message: MessageRef) {
  const counted = await ctx.db
    .query("countedKudosGiven")
    .withIndex("by_message", (q) => q.eq("workspace", message.workspace).eq("conversation", message.conversation).eq("message", message.message))
    .unique();
  return counted !== null;
}

async function addToDay(ctx: MutationCtx, { workspace, giver, day }: KudosGivenEvent, kudos: number) {
  const row = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", giver).eq("day", day))
    .unique();
  if (row === null) await ctx.db.insert("givenByDay", { workspace, member: giver, day, kudos });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos });
}

async function addToPeriod(ctx: MutationCtx, { workspace, giver }: KudosGivenEvent, period: Period, kudos: number) {
  const row = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", giver).eq("period", period))
    .unique();
  if (row === null) await ctx.db.insert("givenTotals", { workspace, member: giver, period, kudos });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos });
}
