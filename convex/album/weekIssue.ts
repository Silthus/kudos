import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import { givingWeekOf } from "../progression/progress";
import type { MemberId } from "../workspace/directory";
import { anEmptyWeek, weekAt, weekRowOf, weekTallyIn, type WeekTally } from "./tallies";

export const weeksShown = 52;

const weekMs = 7 * 24 * 60 * 60 * 1000;
const dayKeyShape = /^\d{4}-\d{2}-\d{2}$/;

export type WeekTab = { week: DayKey; days: number[] };

export type Issue = Required<WeekTally>;

export type WeekEdition = { week: DayKey; weeks: WeekTab[]; issue: Issue | null };

type WeekRow = Doc<"weekTallies">;

export async function weekEditionOf(ctx: QueryCtx, member: MemberId, asked: DayKey | undefined, now: number): Promise<WeekEdition> {
  const thisWeek = await weekAt(ctx, member, now);
  const week = asked ?? thisWeek;
  const [first, newest] = [await weekRows(ctx, member).first(), await weekRows(ctx, member).order("desc").first()];
  if (first === null || newest === null) return { week, weeks: [], issue: null };
  const newestShown = laterOf(thisWeek, newest.week);
  const oldestShown = laterOf(first.week, weeksBefore(newestShown, weeksShown - 1));
  const shown = new Map((await weekRowsBetween(ctx, member, oldestShown, newestShown)).map((row) => [row.week, row]));
  const weeks = weeksBetween(oldestShown, newestShown).map((each) => ({ week: each, days: shown.get(each)?.days ?? anEmptyWeek().days }));
  const hasAnIssue = isAWeek(week) && week >= first.week && week <= newestShown;
  return { week, weeks, issue: hasAnIssue ? issueOf(shown.get(week) ?? (await weekRowOf(ctx, member, week))) : null };
}

function issueOf(row: WeekRow | null): Issue {
  const { packsOpened = 0, newFaces = { people: [], more: 0 }, hoggiesFound = { hoggies: [], more: 0 }, ...tally } = row === null ? anEmptyWeek() : weekTallyIn(row);
  return { ...tally, packsOpened, newFaces, hoggiesFound };
}

function isAWeek(day: DayKey) {
  return dayKeyShape.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && givingWeekOf(day) === day;
}

function laterOf(one: DayKey, other: DayKey) {
  return one > other ? one : other;
}

function weeksBefore(week: DayKey, weeks: number): DayKey {
  return new Date(Date.parse(`${week}T00:00:00Z`) - weeks * weekMs).toISOString().slice(0, 10);
}

function weeksBetween(oldest: DayKey, newest: DayKey): DayKey[] {
  const weeks: DayKey[] = [];
  for (let week = newest; week >= oldest; week = weeksBefore(week, 1)) weeks.push(week);
  return weeks;
}

function weekRows(ctx: QueryCtx, member: MemberId) {
  return ctx.db.query("weekTallies").withIndex("by_member_week", (q) => q.eq("member", member));
}

function weekRowsBetween(ctx: QueryCtx, member: MemberId, oldest: DayKey, newest: DayKey) {
  return ctx.db
    .query("weekTallies")
    .withIndex("by_member_week", (q) => q.eq("member", member).gte("week", oldest).lte("week", newest))
    .collect();
}
