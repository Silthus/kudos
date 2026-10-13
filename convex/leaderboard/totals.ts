import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { GivenMessage } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import { board, ranking, type BoardView, type Entry } from "./board";
import { improvement, type Improvement } from "./improvement";
import { keyOf, keysOf, lastPeriodUpToTheSameDay, periodValidator, type ComparedPeriod, type Days, type Period, type PeriodKey } from "./periods";
import { isOnTheBoards } from "./visibility";

export type EveryoneBoardView = BoardView & { improvement: Improvement | null };

export type RankedRow = { position: number; rank: number; tied: boolean; member: MemberId; name: string | undefined; kudos: number; viewer: boolean };

export type Standing = { kind: "ranked"; position: number; rank: number } | { kind: "not-ranked" } | { kind: "left" };

export type RankedBoard = { rows: RankedRow[]; window: number[]; standing: Standing; improvement: Improvement | null };

type Giver = Entry & { member: MemberId; displayName: string | undefined };

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
  for (const period of keysOf(given.day)) await addToPeriod(ctx, given, period, kudos);
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
  const { givers, viewerLeft, improvement } = await boardFactsOf(ctx, workspace, viewer, period);
  const { rows, window } = ranking(givers, viewer);
  return {
    rows: rows.map(({ position, rank, tied, member, displayName, value, viewer }) => ({ position, rank, tied, member, name: displayName, kudos: value, viewer })),
    window,
    standing: viewerLeft ? { kind: "left" } : standingOf(rows),
    improvement,
  };
}

async function boardFactsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period) {
  const facts = await lookup(ctx, workspace, viewer);
  const member = facts?.kind === "member" ? facts.member : undefined;
  const today = allowanceDay(Date.now(), facts?.kind === "member" ? facts.timeZone : undefined);
  const viewerLeft = member !== undefined && !(await isOnTheBoards(ctx, member));
  const now = await giversOf(ctx, workspace, keyOf(period, today), member);
  const line = period === "all" || member === undefined ? null : await improvementOf(ctx, { workspace, viewer, member, period, today, now });
  if (!viewerLeft) return { givers: now, viewerLeft, improvement: line };
  return { givers: withoutViewer(now, viewer), viewerLeft, improvement: line && withoutPlaces(line) };
}

function standingOf(rows: Array<{ position: number; rank: number; viewer: boolean }>): Standing {
  const mine = rows.find((row) => row.viewer);
  return mine === undefined ? { kind: "not-ranked" } : { kind: "ranked", position: mine.position, rank: mine.rank };
}

type Comparison = { workspace: string; viewer: string; member: MemberId; period: ComparedPeriod; today: DayKey; now: Entry[] };

async function improvementOf(ctx: QueryCtx, { workspace, viewer, member, period, today, now }: Comparison) {
  const before = await giversOn(ctx, workspace, lastPeriodUpToTheSameDay(period, today), member);
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

async function giversOf(ctx: QueryCtx, workspace: string, period: PeriodKey, viewer: MemberId | undefined): Promise<Giver[]> {
  const totals = await ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
  return giversAmong(ctx, new Map(totals.map((total) => [total.member, total.kudos])), viewer);
}

async function giversOn(ctx: QueryCtx, workspace: string, { first, last }: Days, viewer: MemberId): Promise<Giver[]> {
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_workspace_day", (q) => q.eq("workspace", workspace).gte("day", first).lte("day", last))
    .collect();
  const kudosByMember = new Map<MemberId, number>();
  for (const { member, kudos } of days) kudosByMember.set(member, (kudosByMember.get(member) ?? 0) + kudos);
  return giversAmong(ctx, kudosByMember, viewer);
}

async function giversAmong(ctx: QueryCtx, kudosByMember: Map<MemberId, number>, viewer: MemberId | undefined): Promise<Giver[]> {
  const givers = await Promise.all([...kudosByMember].map(([member, kudos]) => giverOf(ctx, member, kudos, viewer)));
  return givers.filter((giver) => giver !== null);
}

async function bestCompletedPeriod(ctx: QueryCtx, member: MemberId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map((total) => total.kudos));
}

async function giverOf(ctx: QueryCtx, member: MemberId, kudos: number, viewer: MemberId | undefined): Promise<Giver | null> {
  const row = await ctx.db.get(member);
  if (row?.kind !== "member") return null;
  if (member !== viewer && !(await isOnTheBoards(ctx, member))) return null;
  return { id: row.user, name: row.name ?? row.user, value: kudos, member, displayName: row.name };
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

async function addToPeriod(ctx: MutationCtx, { workspace, giver }: GivenMessage, period: PeriodKey, kudos: number) {
  const row = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", giver).eq("period", period))
    .unique();
  if (row === null) await ctx.db.insert("givenTotals", { workspace, member: giver, period, kudos });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos });
}
