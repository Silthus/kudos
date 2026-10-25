import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { reportHugsRecapSent } from "../analytics/isolatedUsage";
import { wallClockAt, type DayKey } from "../engine/allowance";
import { threadRootOf } from "../engine/engine";
import { emojiLineOf, type RecapEmojiLine } from "../feedback/albumRecap";
import { settingsFooterFor, type SettingsFooter } from "../feedback/settingsFooter";
import { teaserOf } from "../feedback/teaser";
import { placeOf } from "../messageSettings/messageSettings";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { hasMondayDm } from "../mondayDm/rows";
import { permalinkOf } from "../slack/permalink";
import { convexActionTimeLimitMs } from "../slack/strandedJobs";
import { chatUserOf, isMember, timeZoneOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { workspaceUrlOf } from "../workspace/url";
import { hugsOnAndExposedFor } from "./flag";
import type { MostHugged, HugWeek } from "./weeks";

export type RecapLine = string | { text: string; link: { url: string; label: string } };

export type Recap = { workspace: string; user: string; lines: RecapLine[]; emojiLine: RecapEmojiLine | null; footer: SettingsFooter | null };

export type HugsSection = { lines: RecapLine[]; closing: RecapLine[]; emojiLine: RecapEmojiLine | null };

const recapsPerSweep = 100;
const recapHour = 9;
const triesAtMost = 3;
const dayMs = 24 * 60 * 60 * 1000;
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";

export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const waiting = await ctx.db
      .query("hugWeeks")
      .withIndex("by_recap_due", (q) => q.eq("recap", "waiting"))
      .take(recapsPerSweep);
    for (const week of waiting) await scheduleRecap(ctx, week);
    const stranded = await ctx.db
      .query("hugWeeks")
      .withIndex("by_recap_due", (q) => q.eq("recap", "scheduled").gte("dueAt", 0).lt("dueAt", Date.now() - convexActionTimeLimitMs))
      .take(recapsPerSweep);
    for (const week of stranded) await tryAgainAfterConvexStopped(ctx, week);
    if (waiting.length === recapsPerSweep || stranded.length === recapsPerSweep) await ctx.scheduler.runAfter(0, internal.hugs.recap.sweep, {});
  },
});

const tryArgs = { week: v.id("hugWeeks"), attempt: v.number() };

export const startRecap = internalMutation({
  args: tryArgs,
  handler: async (ctx, { week, attempt }): Promise<Recap | null> => {
    const row = await awaitingTry(ctx, week, attempt - 1);
    if (row === null) return null;
    const dueAt = await recapDueAtOf(ctx, row);
    if (dueAt > Date.now()) {
      await scheduleTry(ctx, row, dueAt, attempt);
      return null;
    }
    if (attempt === 1 && (await hasMondayDm(ctx, row.member, mondayAfter(row.week)))) {
      await ctx.db.patch(week, { recap: "monday-dm" });
      return null;
    }
    if (!(await recapWantedBy(ctx, row.member))) {
      await ctx.db.patch(week, { recap: "skipped" });
      return null;
    }
    await ctx.db.patch(week, { tries: attempt, dueAt: Date.now() });
    const { workspace, user } = await chatUserOf(ctx, row.member);
    const { lines, closing, emojiLine } = await hugsSectionOf(ctx, row);
    return { workspace, user, lines: [...lines, ...closing], emojiLine, footer: await settingsFooterFor(ctx, row.member) };
  },
});

export async function hugsSectionFor(ctx: MutationCtx, member: MemberId, monday: DayKey): Promise<HugsSection | null> {
  const week = await claimedForTheMondayDm(ctx, member, mondayBefore(monday));
  return week !== null && (await recapWantedBy(ctx, member)) ? hugsSectionOf(ctx, week) : null;
}

export async function hugsSentInTheMondayDm(ctx: MutationCtx, member: MemberId, monday: DayKey) {
  const week = await hugWeekOf(ctx, member, mondayBefore(monday));
  if (week !== null) await reportHugsRecapSent(ctx, recapSentOf(week));
}

export const recapLater = internalMutation({
  args: { ...tryArgs, retry: v.object({ at: v.number(), attempt: v.number() }) },
  handler: async (ctx, { week, attempt, retry }) => {
    if ((await awaitingTry(ctx, week, attempt)) === null) return;
    await ctx.db.patch(week, { tries: retry.attempt - 1, dueAt: retry.at });
    await ctx.scheduler.runAt(retry.at, internal.slack.hugsRecap.sendHugsRecap, { week, attempt: retry.attempt });
  },
});

export const recapEnded = internalMutation({
  args: { ...tryArgs, sent: v.boolean() },
  handler: async (ctx, { week, attempt, sent }) => {
    const row = await awaitingTry(ctx, week, attempt);
    if (row === null) return;
    await ctx.db.patch(week, { recap: sent ? "sent" : "failed" });
    if (sent) await reportHugsRecapSent(ctx, recapSentOf(row));
  },
});

function recapSentOf({ workspace, member, given, received, givenXp, receivedXp }: HugWeek) {
  return { workspace, member, given, received, xp: givenXp + receivedXp, at: Date.now() };
}

async function claimedForTheMondayDm(ctx: MutationCtx, member: MemberId, monday: DayKey): Promise<HugWeek | null> {
  const week = await hugWeekOf(ctx, member, monday);
  if (week === null || week.recap === "monday-dm") return week;
  if ((week.recap !== "waiting" && week.recap !== "scheduled") || week.tries > 0) return null;
  await ctx.db.patch(week._id, { recap: "monday-dm" });
  return week;
}

function hugWeekOf(ctx: QueryCtx, member: MemberId, week: DayKey) {
  return ctx.db
    .query("hugWeeks")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
}

async function hugsSectionOf(ctx: QueryCtx, week: HugWeek): Promise<HugsSection> {
  return { ...(await recapLinesOf(ctx, week)), emojiLine: await emojiLineOf(ctx, week, await weekInstantsOf(ctx, week)) };
}

async function scheduleRecap(ctx: MutationCtx, week: HugWeek) {
  await scheduleTry(ctx, week, Math.max(await recapDueAtOf(ctx, week), Date.now()), 1);
}

async function scheduleTry(ctx: MutationCtx, week: HugWeek, dueAt: number, attempt: number) {
  await ctx.db.patch(week._id, { recap: "scheduled", dueAt });
  await ctx.scheduler.runAt(dueAt, internal.slack.hugsRecap.sendHugsRecap, { week: week._id, attempt });
}

async function recapDueAtOf(ctx: QueryCtx, week: HugWeek) {
  return wallClockAt(mondayAfter(week.week), recapHour, (await timeZoneOf(ctx, week.member)) ?? undefined);
}

async function weekInstantsOf(ctx: QueryCtx, week: HugWeek) {
  const timeZone = (await timeZoneOf(ctx, week.member)) ?? undefined;
  return { from: wallClockAt(week.week, 0, timeZone), to: wallClockAt(mondayAfter(week.week), 0, timeZone) };
}

async function tryAgainAfterConvexStopped(ctx: MutationCtx, week: HugWeek) {
  if (week.tries >= triesAtMost) return ctx.db.patch(week._id, { recap: "failed" });
  await ctx.db.patch(week._id, { dueAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.slack.hugsRecap.sendHugsRecap, { week: week._id, attempt: week.tries + 1 });
}

async function awaitingTry(ctx: QueryCtx, week: Id<"hugWeeks">, tries: number): Promise<HugWeek | null> {
  const row = await ctx.db.get(week);
  return row?.recap === "scheduled" && row.tries === tries ? row : null;
}

async function recapWantedBy(ctx: MutationCtx, member: MemberId) {
  if (!(await isMember(ctx, member)) || !(await xpLevelsOnFor(ctx, member))) return false;
  return (await placeOf(ctx, member, "hugs-recap")) === "dm" && (await hugsOnAndExposedFor(ctx, member));
}

async function recapLinesOf(ctx: QueryCtx, week: HugWeek): Promise<Omit<HugsSection, "emojiLine">> {
  const { kudosEmoji } = await settingsOf(ctx, week.workspace);
  const reacted = `reacted :${kudosEmoji}:`;
  const url = await workspaceUrlOf(ctx, week.workspace);
  const mostHugged = week.mostHugged === undefined || url === null ? [] : [await mostHuggedLineOf(ctx, url, reacted, week.workspace, week.mostHugged)];
  const teaser = await teaserOf(ctx, week.member);
  return { lines: [`:${kudosEmoji}: Your week in hugs`, ...countLinesOf(week, reacted), ...mostHugged], closing: [...(teaser === null ? [] : [teaser]), nudge] };
}

function countLinesOf({ given, givenXp, received, receivedXp }: HugWeek, reacted: string): string[] {
  const givenLine = given === 0 ? [] : [`You ${reacted} and gave ${hugsOf(given)} (+${givenXp} XP).`];
  const receivedLine = received === 0 ? [] : [`Teammates ${reacted} on your messages and gave you ${hugsOf(received)} (+${receivedXp} XP).`];
  return [...givenLine, ...receivedLine];
}

async function mostHuggedLineOf(ctx: QueryCtx, url: string, reacted: string, workspace: string, { conversation, message, hugs }: MostHugged): Promise<RecapLine> {
  const ref = { workspace, conversation, message };
  return { text: `${teammatesOf(hugs)} ${reacted} on your most-hugged message: `, link: { url: permalinkOf(url, ref, await threadRootOf(ctx, ref)), label: "open it in Slack" } };
}

function teammatesOf(count: number) {
  return count === 1 ? "1 teammate" : `${count} teammates`;
}

function hugsOf(count: number) {
  return count === 1 ? "1 hug" : `${count} hugs`;
}

export function mondayAfter(week: DayKey): DayKey {
  return mondayShiftedBy(week, 7);
}

function mondayBefore(monday: DayKey): DayKey {
  return mondayShiftedBy(monday, -7);
}

function mondayShiftedBy(monday: DayKey, days: number): DayKey {
  return new Date(Date.parse(`${monday}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
}
