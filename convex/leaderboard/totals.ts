import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { AwardWithId, GivenMessage } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { lookup, type MemberId } from "../workspace/directory";
import type { BoardView, Entry } from "./board";
import { improvement, type Improvement } from "./improvement";
import { peerOf, type Peer } from "./peer";
import { dayOfPeriod, keyOf, lastPeriodUpToTheSameDay, periodOfKey, periodValidator, sameDayLastPeriod, type ComparedPeriod, type Days, type Period, type PeriodKey } from "./periods";
import { addCounts, countedKeys, countOnce, landingAt } from "./counts";
import { hasHugRunningTotal, hugRunningTotalsIn, recordHugRunningTotal } from "./hugRunningTotals";
import { noteThanker } from "./thankers";
import { boardMembers, boardViewOf, giversAmong, rankedOf, withoutViewer, type KudosByMember, type Ranked } from "./rankedBoard";
import { totalUpTo, withKudosOn, type RunningTotal } from "./runningTotal";
import { isOnTheBoards } from "./visibility";

export type { RankedRow, Standing } from "./rankedBoard";

export type GivenMeasure = "kudosGiven" | "hugsGiven";

export const givenMeasureValidator = v.union(v.literal("kudosGiven"), v.literal("hugsGiven"));

export type EveryoneBoardView = BoardView & { measure: GivenMeasure; improvement: Improvement | null; peer: Peer | null };

export type RankedBoard = Ranked & { improvement: Improvement | null; peer: Peer | null };

type Total = Doc<"givenTotals">;

const recipientsAPage = 100;

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }) => {
    if (from === 0) await countGiven(ctx, event);
    const next = from + recipientsAPage;
    for (const award of event.awards.slice(from, next)) await countReceived(ctx, event, award);
    if (next < event.awards.length) await ctx.scheduler.runAfter(0, internal.leaderboard.totals.countKudosGiven, { event, from: next });
  },
});

export async function countGiven(ctx: MutationCtx, given: GivenMessage) {
  if (await wasCounted(ctx, given.message)) return false;
  await ctx.db.insert("countedKudosGiven", given.message);
  await addCounts(ctx, { workspace: given.workspace, member: given.giver, day: given.day }, { kudosGiven: kudosGivenIn(given) });
  return true;
}

export async function countReceived(ctx: MutationCtx, { workspace, giver, at }: Pick<KudosGivenEvent, "workspace" | "giver" | "at">, { award, recipient, kudos }: AwardWithId) {
  const landing = await landingAt(ctx, workspace, recipient, at);
  await noteThanker(ctx, landing, giver);
  if (!(await countOnce(ctx, workspace, countedKeys.kudosReceived(award)))) return false;
  await addCounts(ctx, landing, { kudosReceived: kudos });
  return true;
}

export const everyoneBoard = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: v.optional(periodValidator), measure: v.optional(givenMeasureValidator) },
  handler: (ctx, { workspace, viewer, period = "week", measure = "kudosGiven" }) => everyoneBoardOf(ctx, workspace, viewer, period, measure),
});

export async function everyoneBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period, measure: GivenMeasure): Promise<EveryoneBoardView> {
  const { improvement, peer, ...facts } = await boardFactsOf(ctx, workspace, viewer, period, measure);
  return { ...boardViewOf(facts), measure, improvement, peer };
}

export async function rankedBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<RankedBoard> {
  const { improvement, peer, ...facts } = await boardFactsOf(ctx, workspace, viewer, period, "kudosGiven");
  return { ...rankedOf(facts), improvement, peer };
}

export async function fillRunningTotal(ctx: MutationCtx, total: Total) {
  const kudosFilled = await fillKudosRunningTotal(ctx, total);
  const hugsFilled = await fillHugRunningTotal(ctx, total);
  return kudosFilled || hugsFilled;
}

async function fillKudosRunningTotal(ctx: MutationCtx, total: Total) {
  if (total.runningTotal !== undefined) return false;
  const runningTotal = await runningTotalFromDays(ctx, total, "kudosGiven");
  if (runningTotal === undefined) return false;
  await ctx.db.patch(total._id, { runningTotal });
  return true;
}

async function fillHugRunningTotal(ctx: MutationCtx, total: Total) {
  if (givenIn(total, "hugsGiven") === 0 || (await hasHugRunningTotal(ctx, total.member, total.period))) return false;
  const runningTotal = await runningTotalFromDays(ctx, total, "hugsGiven");
  if (runningTotal === undefined) return false;
  await recordHugRunningTotal(ctx, total, runningTotal);
  return true;
}

async function boardFactsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period, measure: GivenMeasure) {
  const facts = await lookup(ctx, workspace, viewer);
  const member = facts?.kind === "member" ? facts.member : undefined;
  const today = allowanceDay(Date.now(), facts?.kind === "member" ? facts.timeZone : undefined);
  const viewerLeft = member !== undefined && !(await isOnTheBoards(ctx, member));
  const boardMemberOf = boardMembers(ctx, member);
  const kudosNow = await givenByMemberIn(ctx, workspace, keyOf(period, today), measure);
  const kudosBefore = period === "all" ? null : await givenUpToTheSameDay(ctx, workspace, period, today, measure);
  const now = await giversAmong(kudosNow, boardMemberOf);
  const before = kudosBefore === null ? [] : await giversAmong(kudosBefore, boardMemberOf);
  const line = period === "all" || member === undefined ? null : await improvementOf(ctx, { viewer, member, period, today, now, before, measure });
  const peer = kudosBefore === null || member === undefined ? null : await peerOf(ctx, member, { now: kudosNow, before: kudosBefore });
  if (!viewerLeft) return { givers: now, before, viewer, viewerLeft, improvement: line, peer };
  return { givers: withoutViewer(now, viewer), before: withoutViewer(before, viewer), viewer, viewerLeft, improvement: line && withoutPlaces(line), peer };
}

type Comparison = { viewer: string; member: MemberId; period: ComparedPeriod; today: DayKey; now: Entry[]; before: Entry[]; measure: GivenMeasure };

async function improvementOf(ctx: QueryCtx, { viewer, member, period, today, now, before, measure }: Comparison) {
  return improvement(now, before, viewer, await bestCompletedPeriod(ctx, member, period, today, measure));
}

function withoutPlaces(line: Improvement): Improvement {
  return "best" in line ? line : { gain: line.gain };
}

function kudosGivenIn(given: GivenMessage) {
  return given.awards.reduce((sum, award) => sum + award.kudos, 0);
}

function givenIn(counted: Total | Doc<"givenByDay">, measure: GivenMeasure): number {
  return measure === "kudosGiven" ? counted.kudos : (counted.hugsGiven ?? 0);
}

async function givenByMemberIn(ctx: QueryCtx, workspace: string, period: PeriodKey, measure: GivenMeasure): Promise<KudosByMember> {
  const totals = await totalsIn(ctx, workspace, period);
  return new Map(totals.map((total) => [total.member, givenIn(total, measure)]));
}

async function givenUpToTheSameDay(ctx: QueryCtx, workspace: string, period: ComparedPeriod, today: DayKey, measure: GivenMeasure): Promise<KudosByMember> {
  const { key, day } = sameDayLastPeriod(period, today);
  const totals = await totalsIn(ctx, workspace, key);
  const runningTotals = measure === "kudosGiven" ? kudosRunningTotalsOf(totals) : await hugRunningTotalsOf(ctx, workspace, key, totals);
  if (runningTotals === null) return dayTotalsUpToTheSameDay(ctx, workspace, lastPeriodUpToTheSameDay(period, today), measure);
  return new Map([...runningTotals].map(([member, runningTotal]) => [member, totalUpTo(runningTotal, day)]));
}

function kudosRunningTotalsOf(totals: Total[]): Map<MemberId, RunningTotal> | null {
  return totals.every(hasRunningTotal) ? new Map(totals.map((total) => [total.member, total.runningTotal])) : null;
}

async function hugRunningTotalsOf(ctx: QueryCtx, workspace: string, period: PeriodKey, totals: Total[]): Promise<Map<MemberId, RunningTotal> | null> {
  const runningTotals = await hugRunningTotalsIn(ctx, workspace, period);
  return totals.every((total) => givenIn(total, "hugsGiven") === 0 || runningTotals.has(total.member)) ? runningTotals : null;
}

async function dayTotalsUpToTheSameDay(ctx: QueryCtx, workspace: string, { first, last }: Days, measure: GivenMeasure): Promise<KudosByMember> {
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_workspace_day", (q) => q.eq("workspace", workspace).gte("day", first).lte("day", last))
    .collect();
  const givenByMember: KudosByMember = new Map();
  for (const day of days) givenByMember.set(day.member, (givenByMember.get(day.member) ?? 0) + givenIn(day, measure));
  return givenByMember;
}

function hasRunningTotal(total: Total): total is Total & { runningTotal: RunningTotal } {
  return total.runningTotal !== undefined;
}

export async function giversIn(ctx: QueryCtx, workspace: string, period: PeriodKey): Promise<number> {
  return (await totalsIn(ctx, workspace, period)).filter(({ kudos }) => kudos > 0).length;
}

function totalsIn(ctx: QueryCtx, workspace: string, period: PeriodKey) {
  return ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
}

async function runningTotalFromDays(ctx: MutationCtx, { member, period: key }: Total, measure: GivenMeasure): Promise<RunningTotal | undefined> {
  const period = periodOfKey(key);
  if (period === null) return undefined;
  const days = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", member).gte("day", period.days.first).lte("day", period.days.last))
    .collect();
  return days.reduce((runningTotal, day) => withKudosOn(runningTotal, dayOfPeriod(period.period, day.day), givenIn(day, measure)), [] as RunningTotal);
}

async function bestCompletedPeriod(ctx: QueryCtx, member: MemberId, period: ComparedPeriod, today: DayKey, measure: GivenMeasure) {
  const completed = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  const given = completed.map((total) => givenIn(total, measure)).filter((count) => count > 0);
  return given.length === 0 ? null : Math.max(...given);
}

async function wasCounted(ctx: QueryCtx, message: MessageRef) {
  const counted = await ctx.db
    .query("countedKudosGiven")
    .withIndex("by_message", (q) => q.eq("workspace", message.workspace).eq("conversation", message.conversation).eq("message", message.message))
    .unique();
  return counted !== null;
}
