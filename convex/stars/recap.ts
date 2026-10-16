import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { reportStarsRecapSent } from "../analytics/isolatedUsage";
import { wallClockAt, type DayKey } from "../engine/allowance";
import { settingsFooterFor, type SettingsFooter } from "../feedback/settingsFooter";
import { placeOf } from "../messageSettings/messageSettings";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { permalinkOf } from "../slack/permalink";
import { convexActionTimeLimitMs } from "../slack/strandedJobs";
import { chatUserOf, isMember, timeZoneOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { workspaceUrlOf } from "../workspace/url";
import { starsOnAndExposedFor } from "./flag";
import type { MostStarred, StarWeek } from "./weeks";

export type RecapLine = string | { text: string; link: { url: string; label: string } };

export type Recap = { workspace: string; user: string; lines: RecapLine[]; footer: SettingsFooter | null };

const recapsPerSweep = 100;
const recapHour = 9;
const triesAtMost = 3;
const dayMs = 24 * 60 * 60 * 1000;
const nudge = "Stars are a quick thanks. A kudos that names a teammate and says why earns much more XP.";

export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const waiting = await ctx.db
      .query("starWeeks")
      .withIndex("by_recap_due", (q) => q.eq("recap", "waiting"))
      .take(recapsPerSweep);
    for (const week of waiting) await scheduleRecap(ctx, week);
    const stranded = await ctx.db
      .query("starWeeks")
      .withIndex("by_recap_due", (q) => q.eq("recap", "scheduled").gte("dueAt", 0).lt("dueAt", Date.now() - convexActionTimeLimitMs))
      .take(recapsPerSweep);
    for (const week of stranded) await tryAgainAfterConvexStopped(ctx, week);
    if (waiting.length === recapsPerSweep || stranded.length === recapsPerSweep) await ctx.scheduler.runAfter(0, internal.stars.recap.sweep, {});
  },
});

const tryArgs = { week: v.id("starWeeks"), attempt: v.number() };

export const startRecap = internalMutation({
  args: tryArgs,
  handler: async (ctx, { week, attempt }): Promise<Recap | null> => {
    const row = await awaitingTry(ctx, week, attempt - 1);
    if (row === null) return null;
    if (!(await recapWantedBy(ctx, row.member))) {
      await ctx.db.patch(week, { recap: "skipped" });
      return null;
    }
    await ctx.db.patch(week, { tries: attempt, dueAt: Date.now() });
    const { workspace, user } = await chatUserOf(ctx, row.member);
    return { workspace, user, lines: await recapLinesOf(ctx, row), footer: await settingsFooterFor(ctx, row.member) };
  },
});

export const recapLater = internalMutation({
  args: { ...tryArgs, retry: v.object({ at: v.number(), attempt: v.number() }) },
  handler: async (ctx, { week, attempt, retry }) => {
    if ((await awaitingTry(ctx, week, attempt)) === null) return;
    await ctx.db.patch(week, { tries: retry.attempt - 1, dueAt: retry.at });
    await ctx.scheduler.runAt(retry.at, internal.slack.starsRecap.sendStarsRecap, { week, attempt: retry.attempt });
  },
});

export const recapEnded = internalMutation({
  args: { ...tryArgs, sent: v.boolean() },
  handler: async (ctx, { week, attempt, sent }) => {
    const row = await awaitingTry(ctx, week, attempt);
    if (row === null) return;
    await ctx.db.patch(week, { recap: sent ? "sent" : "failed" });
    if (sent) await reportStarsRecapSent(ctx, { workspace: row.workspace, member: row.member, given: row.given, received: row.received, xp: row.givenXp + row.receivedXp, at: Date.now() });
  },
});

async function scheduleRecap(ctx: MutationCtx, week: StarWeek) {
  const dueAt = wallClockAt(mondayAfter(week.week), recapHour, (await timeZoneOf(ctx, week.member)) ?? undefined);
  await ctx.db.patch(week._id, { recap: "scheduled", dueAt });
  await ctx.scheduler.runAt(dueAt, internal.slack.starsRecap.sendStarsRecap, { week: week._id, attempt: 1 });
}

async function tryAgainAfterConvexStopped(ctx: MutationCtx, week: StarWeek) {
  if (week.tries >= triesAtMost) return ctx.db.patch(week._id, { recap: "failed" });
  await ctx.db.patch(week._id, { dueAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.slack.starsRecap.sendStarsRecap, { week: week._id, attempt: week.tries + 1 });
}

async function awaitingTry(ctx: QueryCtx, week: Id<"starWeeks">, tries: number): Promise<StarWeek | null> {
  const row = await ctx.db.get(week);
  return row?.recap === "scheduled" && row.tries === tries ? row : null;
}

async function recapWantedBy(ctx: MutationCtx, member: MemberId) {
  if (!(await isMember(ctx, member)) || !(await xpLevelsOnFor(ctx, member))) return false;
  return (await placeOf(ctx, member, "stars-recap")) === "dm" && (await starsOnAndExposedFor(ctx, member));
}

async function recapLinesOf(ctx: QueryCtx, week: StarWeek): Promise<RecapLine[]> {
  const { kudosEmoji } = await settingsOf(ctx, week.workspace);
  const url = await workspaceUrlOf(ctx, week.workspace);
  const mostStarred = week.mostStarred === undefined || url === null ? [] : [mostStarredLineOf(url, week.workspace, week.mostStarred)];
  return [`:${kudosEmoji}: Your week in stars`, countsLineOf(week), ...mostStarred, nudge];
}

function countsLineOf({ given, givenXp, received, receivedXp }: StarWeek) {
  if (received === 0) return `You gave ${starsOf(given)} (+${givenXp} XP).`;
  if (given === 0) return `You got ${starsOf(received)} (+${receivedXp} XP).`;
  return `You gave ${starsOf(given)} (+${givenXp} XP) and got ${received} (+${receivedXp} XP).`;
}

function mostStarredLineOf(url: string, workspace: string, { conversation, message, stars }: MostStarred): RecapLine {
  return { text: `Your most-starred message got ${starsOf(stars)}: `, link: { url: permalinkOf(url, { workspace, conversation, message }, null), label: "open it in Slack" } };
}

function starsOf(count: number) {
  return count === 1 ? "1 star" : `${count} stars`;
}

function mondayAfter(week: DayKey): DayKey {
  return new Date(Date.parse(`${week}T00:00:00Z`) + 7 * dayMs).toISOString().slice(0, 10);
}
