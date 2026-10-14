import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { GivenMessage } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import { board, placesClimbed, ranking, type BoardView, type Entry } from "./board";
import { improvement, type Improvement } from "./improvement";
import { dayOfPeriod, keyOf, periodOfKey, periods, periodValidator, sameDayLastPeriod, type ComparedPeriod, type Period, type PeriodKey } from "./periods";
import { totalUpTo, withKudosOn, type RunningTotal } from "./runningTotal";
import { isOnTheBoards } from "./visibility";

export type EveryoneBoardView = BoardView & { improvement: Improvement | null };

export type RankedRow = {
  position: number;
  rank: number;
  tied: boolean;
  member: MemberId;
  name: string | undefined;
  picture: string | null;
  kudos: number;
  viewer: boolean;
  climbed: number | null;
};

export type Standing = { kind: "ranked"; position: number; rank: number } | { kind: "not-ranked" } | { kind: "left" };

export type RankedBoard = { rows: RankedRow[]; window: number[]; standing: Standing; improvement: Improvement | null };

type Giver = Entry & { member: MemberId; displayName: string | undefined; picture: string | null };

type Total = Doc<"givenTotals">;

type KudosByMember = Map<MemberId, number>;

type BoardMemberOf = (member: MemberId) => Promise<Giver | null>;

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
  const { givers, viewerLeft, improvement } = await boardFactsOf(ctx, workspace, viewer, period);
  if (!viewerLeft) return { ...board(givers, viewer), improvement };
  return { rows: board(givers, viewer).rows, viewerAbsent: "left", improvement };
}

export async function rankedBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<RankedBoard> {
  const { givers, before, viewerLeft, improvement } = await boardFactsOf(ctx, workspace, viewer, period);
  const { rows, window } = ranking(givers, viewer);
  const climbed = placesClimbed(givers, before);
  return {
    rows: rows.map(({ position, rank, tied, id, member, displayName, picture, value, viewer }) => ({
      position,
      rank,
      tied,
      member,
      name: displayName,
      picture,
      kudos: value,
      viewer,
      climbed: climbed.get(id) ?? null,
    })),
    window,
    standing: viewerLeft ? { kind: "left" } : standingOf(rows),
    improvement,
  };
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
  const now = await giversAmong(await totalsOf(ctx, workspace, keyOf(period, today)), boardMemberOf);
  const before = period === "all" ? [] : await giversAmong(await totalsUpToTheSameDay(ctx, workspace, period, today), boardMemberOf);
  const line = period === "all" || member === undefined ? null : await improvementOf(ctx, { viewer, member, period, today, now, before });
  if (!viewerLeft) return { givers: now, before, viewerLeft, improvement: line };
  return { givers: withoutViewer(now, viewer), before: withoutViewer(before, viewer), viewerLeft, improvement: line && withoutPlaces(line) };
}

function standingOf(rows: Array<{ position: number; rank: number; viewer: boolean }>): Standing {
  const mine = rows.find((row) => row.viewer);
  return mine === undefined ? { kind: "not-ranked" } : { kind: "ranked", position: mine.position, rank: mine.rank };
}

type Comparison = { viewer: string; member: MemberId; period: ComparedPeriod; today: DayKey; now: Entry[]; before: Entry[] };

async function improvementOf(ctx: QueryCtx, { viewer, member, period, today, now, before }: Comparison) {
  return improvement(now, before, viewer, await bestCompletedPeriod(ctx, member, period, today));
}

function withoutViewer(entries: Giver[], viewer: string) {
  return entries.filter((entry) => entry.id !== viewer);
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
  const upToTheSameDay = await Promise.all(totals.map(async (total) => [total.member, totalUpTo((await runningTotalOf(ctx, total)) ?? [], day)] as const));
  return new Map(upToTheSameDay);
}

function totalsIn(ctx: QueryCtx, workspace: string, period: PeriodKey) {
  return ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
}

async function runningTotalOf(ctx: QueryCtx, total: Total) {
  return total.runningTotal ?? (await runningTotalFromDays(ctx, total));
}

async function runningTotalFromDays(ctx: QueryCtx, { member, period: key }: Total): Promise<RunningTotal | undefined> {
  const period = periodOfKey(key);
  if (period === null) return undefined;
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", member).gte("day", period.days.first).lte("day", period.days.last))
    .collect();
  return days.reduce((runningTotal, { day, kudos }) => withKudosOn(runningTotal, dayOfPeriod(period.period, day), kudos), [] as RunningTotal);
}

async function giversAmong(kudosByMember: KudosByMember, boardMemberOf: BoardMemberOf): Promise<Giver[]> {
  const givers = await Promise.all([...kudosByMember].filter(([, kudos]) => kudos > 0).map(([member, kudos]) => giverOf(boardMemberOf, member, kudos)));
  return givers.filter((giver) => giver !== null);
}

async function giverOf(boardMemberOf: BoardMemberOf, member: MemberId, kudos: number): Promise<Giver | null> {
  const giver = await boardMemberOf(member);
  return giver === null ? null : { ...giver, value: kudos };
}

function boardMembers(ctx: QueryCtx, viewer: MemberId | undefined): BoardMemberOf {
  const known = new Map<MemberId, Promise<Giver | null>>();
  return (member) => {
    if (!known.has(member)) known.set(member, boardMemberOf(ctx, member, viewer));
    return known.get(member)!;
  };
}

async function boardMemberOf(ctx: QueryCtx, member: MemberId, viewer: MemberId | undefined): Promise<Giver | null> {
  const row = await ctx.db.get(member);
  if (row?.kind !== "member") return null;
  if (member !== viewer && !(await isOnTheBoards(ctx, member))) return null;
  return { id: row.user, name: row.name ?? row.user, value: 0, member, displayName: row.name, picture: row.picture ?? null };
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
