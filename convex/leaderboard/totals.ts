import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import { board, type BoardView, type Entry } from "./board";
import { improvement, type Improvement } from "./improvement";
import { keyOf, keysOf, lastPeriodUpToTheSameDay, periodValidator, type ComparedPeriod, type Days, type PeriodKey } from "./periods";

export type EveryoneBoardView = BoardView & { improvement: Improvement | null };

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }) => {
    if (await wasCounted(ctx, event.message)) return;
    await ctx.db.insert("countedKudosGiven", event.message);
    const kudos = kudosGivenIn(event);
    await addToDay(ctx, event, kudos);
    for (const period of keysOf(event.day)) await addToPeriod(ctx, event, period, kudos);
  },
});

export const everyoneBoard = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: v.optional(periodValidator) },
  handler: async (ctx, { workspace, viewer, period = "week" }): Promise<EveryoneBoardView> => {
    const facts = await lookup(ctx, workspace, viewer);
    const today = allowanceDay(Date.now(), facts?.kind === "member" ? facts.timeZone : undefined);
    const now = await entriesOf(ctx, workspace, keyOf(period, today));
    const member = facts?.kind === "member" ? facts.member : undefined;
    const line = period === "all" || member === undefined ? null : await improvementOf(ctx, { workspace, viewer, member, period, today, now });
    return { ...board(now, viewer), improvement: line };
  },
});

type Comparison = { workspace: string; viewer: string; member: MemberId; period: ComparedPeriod; today: DayKey; now: Entry[] };

async function improvementOf(ctx: QueryCtx, { workspace, viewer, member, period, today, now }: Comparison) {
  const before = await entriesOn(ctx, workspace, lastPeriodUpToTheSameDay(period, today));
  return improvement(now, before, viewer, await bestCompletedPeriod(ctx, member, period, today));
}

function kudosGivenIn(event: KudosGivenEvent) {
  return event.awards.reduce((sum, award) => sum + award.kudos, 0);
}

async function entriesOf(ctx: QueryCtx, workspace: string, period: PeriodKey): Promise<Entry[]> {
  const totals = await ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
  return entriesOfMembers(ctx, new Map(totals.map((total) => [total.member, total.kudos])));
}

async function entriesOn(ctx: QueryCtx, workspace: string, { first, last }: Days): Promise<Entry[]> {
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_workspace_day", (q) => q.eq("workspace", workspace).gte("day", first).lte("day", last))
    .collect();
  const kudosByMember = new Map<MemberId, number>();
  for (const { member, kudos } of days) kudosByMember.set(member, (kudosByMember.get(member) ?? 0) + kudos);
  return entriesOfMembers(ctx, kudosByMember);
}

async function entriesOfMembers(ctx: QueryCtx, kudosByMember: Map<MemberId, number>): Promise<Entry[]> {
  const entries = await Promise.all([...kudosByMember].map(([member, kudos]) => entryOf(ctx, member, kudos)));
  return entries.filter((entry) => entry !== null);
}

async function bestCompletedPeriod(ctx: QueryCtx, member: MemberId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map((total) => total.kudos));
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

async function addToPeriod(ctx: MutationCtx, { workspace, giver }: KudosGivenEvent, period: PeriodKey, kudos: number) {
  const row = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", giver).eq("period", period))
    .unique();
  if (row === null) await ctx.db.insert("givenTotals", { workspace, member: giver, period, kudos });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos });
}
