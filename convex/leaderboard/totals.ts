import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { GivenMessage } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import type { BoardView, Entry } from "./board";
import { improvement, type Improvement } from "./improvement";
import { peerOf, type Peer } from "./peer";
import { dayOfPeriod, keyOf, lastPeriodUpToTheSameDay, periodOfKey, periods, periodValidator, sameDayLastPeriod, type ComparedPeriod, type Days, type Period, type PeriodKey } from "./periods";
import { boardMembers, boardViewOf, giversAmong, rankedOf, withoutViewer, type KudosByMember, type Ranked } from "./rankedBoard";
import { totalUpTo, withKudosOn, type RunningTotal } from "./runningTotal";
import { isOnTheBoards } from "./visibility";

export type { RankedRow, Standing } from "./rankedBoard";

export type EveryoneBoardView = BoardView & { improvement: Improvement | null; peer: Peer | null };

export type RankedBoard = Ranked & { improvement: Improvement | null; peer: Peer | null };

type Total = Doc<"givenTotals">;

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }) => {
    await countGiven(ctx, event);
  },
});

export async function countGiven(ctx: MutationCtx, given: GivenMessage) {
  if (await wasCounted(ctx, given.message)) return false;
  await ctx.db.insert("countedKudosGiven", given.message);
  const kudos = kudosGivenIn(given);
  await addToDay(ctx, given, kudos);
  for (const period of periods) await addToPeriod(ctx, given, period, kudos);
  return true;
}

export const everyoneBoard = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: v.optional(periodValidator) },
  handler: (ctx, { workspace, viewer, period = "week" }) => everyoneBoardOf(ctx, workspace, viewer, period),
});

export async function everyoneBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<EveryoneBoardView> {
  const { improvement, peer, ...facts } = await boardFactsOf(ctx, workspace, viewer, period);
  return { ...boardViewOf(facts), improvement, peer };
}

export async function rankedBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<RankedBoard> {
  const { improvement, peer, ...facts } = await boardFactsOf(ctx, workspace, viewer, period);
  return { ...rankedOf(facts), improvement, peer };
}

export async function fillRunningTotal(ctx: MutationCtx, total: Total) {
  if (total.runningTotal !== undefined) return false;
  const runningTotal = await runningTotalFromDays(ctx, total);
  if (runningTotal === undefined) return false;
  await ctx.db.patch(total._id, { runningTotal });
  return true;
}

async function boardFactsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period) {
  const facts = await lookup(ctx, workspace, viewer);
  const member = facts?.kind === "member" ? facts.member : undefined;
  const today = allowanceDay(Date.now(), facts?.kind === "member" ? facts.timeZone : undefined);
  const viewerLeft = member !== undefined && !(await isOnTheBoards(ctx, member));
  const boardMemberOf = boardMembers(ctx, member);
  const kudosNow = await totalsOf(ctx, workspace, keyOf(period, today));
  const kudosBefore = period === "all" ? null : await totalsUpToTheSameDay(ctx, workspace, period, today);
  const now = await giversAmong(kudosNow, boardMemberOf);
  const before = kudosBefore === null ? [] : await giversAmong(kudosBefore, boardMemberOf);
  const line = period === "all" || member === undefined ? null : await improvementOf(ctx, { viewer, member, period, today, now, before });
  const peer = kudosBefore === null || member === undefined ? null : await peerOf(ctx, member, { now: kudosNow, before: kudosBefore });
  if (!viewerLeft) return { givers: now, before, viewer, viewerLeft, improvement: line, peer };
  return { givers: withoutViewer(now, viewer), before: withoutViewer(before, viewer), viewer, viewerLeft, improvement: line && withoutPlaces(line), peer };
}

type Comparison = { viewer: string; member: MemberId; period: ComparedPeriod; today: DayKey; now: Entry[]; before: Entry[] };

async function improvementOf(ctx: QueryCtx, { viewer, member, period, today, now, before }: Comparison) {
  return improvement(now, before, viewer, await bestCompletedPeriod(ctx, member, period, today));
}

function withoutPlaces(line: Improvement): Improvement {
  return "best" in line ? line : { gain: line.gain };
}

function kudosGivenIn(given: GivenMessage) {
  return given.awards.reduce((sum, award) => sum + award.kudos, 0);
}

async function totalsOf(ctx: QueryCtx, workspace: string, period: PeriodKey): Promise<KudosByMember> {
  const totals = await totalsIn(ctx, workspace, period);
  return new Map(totals.map((total) => [total.member, total.kudos]));
}

async function totalsUpToTheSameDay(ctx: QueryCtx, workspace: string, period: ComparedPeriod, today: DayKey): Promise<KudosByMember> {
  const { key, day } = sameDayLastPeriod(period, today);
  const totals = await totalsIn(ctx, workspace, key);
  if (!totals.every(hasRunningTotal)) return dayTotalsUpToTheSameDay(ctx, workspace, lastPeriodUpToTheSameDay(period, today));
  return new Map(totals.map((total) => [total.member, totalUpTo(total.runningTotal, day)]));
}

async function dayTotalsUpToTheSameDay(ctx: QueryCtx, workspace: string, { first, last }: Days): Promise<KudosByMember> {
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_workspace_day", (q) => q.eq("workspace", workspace).gte("day", first).lte("day", last))
    .collect();
  const kudosByMember: KudosByMember = new Map();
  for (const { member, kudos } of days) kudosByMember.set(member, (kudosByMember.get(member) ?? 0) + kudos);
  return kudosByMember;
}

function hasRunningTotal(total: Total): total is Total & { runningTotal: RunningTotal } {
  return total.runningTotal !== undefined;
}

function totalsIn(ctx: QueryCtx, workspace: string, period: PeriodKey) {
  return ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
}

async function runningTotalFromDays(ctx: MutationCtx, { member, period: key }: Total): Promise<RunningTotal | undefined> {
  const period = periodOfKey(key);
  if (period === null) return undefined;
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", member).gte("day", period.days.first).lte("day", period.days.last))
    .collect();
  return days.reduce((runningTotal, { day, kudos }) => withKudosOn(runningTotal, dayOfPeriod(period.period, day), kudos), [] as RunningTotal);
}

async function bestCompletedPeriod(ctx: QueryCtx, member: MemberId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map((total) => total.kudos));
}

async function wasCounted(ctx: QueryCtx, message: MessageRef) {
  const counted = await ctx.db
    .query("countedKudosGiven")
    .withIndex("by_message", (q) => q.eq("workspace", message.workspace).eq("conversation", message.conversation).eq("message", message.message))
    .unique();
  return counted !== null;
}

async function addToDay(ctx: MutationCtx, { workspace, giver, day }: GivenMessage, kudos: number) {
  const row = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", giver).eq("day", day))
    .unique();
  if (row === null) await ctx.db.insert("givenByDay", { workspace, member: giver, day, kudos });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos });
}

async function addToPeriod(ctx: MutationCtx, { workspace, giver, day }: GivenMessage, period: Period, kudos: number) {
  const key = keyOf(period, day);
  const row = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", giver).eq("period", key))
    .unique();
  const added = runningTotalAdding(period, row, day, kudos);
  if (row === null) await ctx.db.insert("givenTotals", { workspace, member: giver, period: key, kudos, ...added });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos, ...added });
}

function runningTotalAdding(period: Period, row: Total | null, day: DayKey, kudos: number) {
  if (period === "all") return {};
  const runningTotal = row === null ? [] : row.runningTotal;
  return runningTotal === undefined ? {} : { runningTotal: withKudosOn(runningTotal, dayOfPeriod(period, day), kudos) };
}
