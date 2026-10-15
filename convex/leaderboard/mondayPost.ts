import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import { allowanceDay, wallClockAt, weekOf, type DayKey } from "../engine/allowance";
import { availableIn } from "../groups/groups";
import { xpLevelsShownIn } from "../progression/xpLevels";
import type { MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { workspaceGroupsBoardOf } from "./groupBoards";
import { mondayPostOutcomeValidator } from "./mondayPostOutcome";
import { wholeWeekBefore } from "./periods";
import { isTimeZone } from "./timeZones";
import { giversIn } from "./totals";

export const mondayPostFlag = { key: "monday-post", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type MondayPostChange = { on: boolean; timeZone?: string };

export type MondayPostSwitch = { channel: string; on: boolean; timeZone: string; cantPost: boolean };

export type PostedGroup = { rank: number; name: string; perMember: number };

export type MondayPost = { groups: PostedGroup[]; mostImproved: string | null; givers: number };

export type ClaimedWeek = { claim: Id<"mondayPostClaims">; channel: string; post: MondayPost };

type Admin = { member: MemberId; admin: boolean; timeZone: string | undefined };

type Settings = Doc<"mondayPostSettings">;

const postedAtHour = 9;
const groupsPosted = 3;
const dayMs = 24 * 60 * 60 * 1000;

export async function mondayPostSwitchShownTo(ctx: MutationCtx, workspace: string, person: Admin): Promise<MondayPostSwitch | null> {
  if (!(await setsMondayPost(ctx, person))) return null;
  const channel = await switchableChannelIn(ctx, workspace);
  if (channel === null) return null;
  const settings = await settingsRow(ctx, workspace);
  return { channel, on: settings?.on ?? false, timeZone: settings?.timeZone ?? zoneOf(person), cantPost: await couldNotPostIn(ctx, workspace, channel) };
}

export async function setMondayPost(ctx: MutationCtx, workspace: string, person: Admin, change: MondayPostChange): Promise<boolean> {
  if (!(await setsMondayPost(ctx, person))) return false;
  const settings = await settingsRow(ctx, workspace);
  if (!change.on) return switchOff(ctx, settings);
  if (change.timeZone !== undefined && !isTimeZone(change.timeZone)) return false;
  if ((await switchableChannelIn(ctx, workspace)) === null) return false;
  const timeZone = change.timeZone ?? (settings?.on ? settings.timeZone : zoneOf(person));
  if (settings?.on && settings.timeZone === timeZone) return false;
  await scheduleNextPost(ctx, await switchOn(ctx, workspace, settings, timeZone));
  return true;
}

async function switchOn(ctx: MutationCtx, workspace: string, settings: Settings | null, timeZone: string): Promise<Settings> {
  const switchedOn = { workspace, on: true, timeZone, generation: (settings?.generation ?? 0) + 1, nextPostAt: undefined };
  if (settings === null) return (await ctx.db.get(await ctx.db.insert("mondayPostSettings", switchedOn)))!;
  await ctx.db.patch(settings._id, switchedOn);
  return { ...settings, ...switchedOn };
}

export const claimWeek = internalMutation({
  args: { workspace: v.string(), generation: v.number() },
  handler: async (ctx, { workspace, generation }): Promise<ClaimedWeek | null> => {
    const settings = await settingsRow(ctx, workspace);
    if (settings === null || !settings.on || settings.generation !== generation) return null;
    await scheduleNextPost(ctx, settings);
    const thisMonday = weekOf(allowanceDay(Date.now(), settings.timeZone)).monday;
    if (Date.now() < postingTimeOf(thisMonday, settings.timeZone) || (await claimOf(ctx, workspace, thisMonday)) !== null) return null;
    const channel = await postableChannelIn(ctx, workspace);
    if (channel === null) return null;
    const post = await lastWeeksPostOf(ctx, workspace, thisMonday);
    const claim = await ctx.db.insert("mondayPostClaims", { workspace, week: thisMonday, claimedAt: Date.now(), channel, outcome: post.givers === 0 ? "nobody-gave" : "claimed" });
    return post.givers === 0 ? null : { claim, channel, post };
  },
});

export const recordOutcome = internalMutation({
  args: { claim: v.id("mondayPostClaims"), outcome: mondayPostOutcomeValidator },
  handler: async (ctx, { claim, outcome }) => {
    const row = await ctx.db.get(claim);
    if (row === null || row.outcome !== "claimed") return;
    await ctx.db.patch(claim, { outcome });
    await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace: row.workspace });
  },
});

function nextPostAfter(at: number, timeZone: string): number {
  const thisMonday = weekOf(allowanceDay(at, timeZone)).monday;
  const thisWeeks = postingTimeOf(thisMonday, timeZone);
  return thisWeeks > at ? thisWeeks : postingTimeOf(dayAfter(thisMonday, 7), timeZone);
}

function postingTimeOf(monday: DayKey, timeZone: string) {
  return wallClockAt(monday, postedAtHour, timeZone);
}

async function setsMondayPost(ctx: MutationCtx, { member, admin }: Admin) {
  if (!admin) return false;
  const applies = await memberDecision(ctx, mondayPostFlag, member);
  await exposed(ctx, mondayPostFlag, member, applies);
  return applies;
}

async function switchOff(ctx: MutationCtx, settings: Settings | null) {
  if (settings === null || !settings.on) return false;
  await ctx.db.patch(settings._id, { on: false, generation: settings.generation + 1 });
  return true;
}

async function scheduleNextPost(ctx: MutationCtx, settings: Settings) {
  const { workspace, timeZone, generation } = settings;
  const nextPostAt = nextPostAfter(Date.now(), timeZone);
  if (settings.nextPostAt === nextPostAt) return;
  await ctx.db.patch(settings._id, { nextPostAt });
  await ctx.scheduler.runAt(nextPostAt, internal.slack.mondayPost.postMondayPost, { workspace, generation });
}

async function postableChannelIn(ctx: MutationCtx, workspace: string) {
  if (!(await workspaceDecision(ctx, mondayPostFlag, workspace))) return null;
  return switchableChannelIn(ctx, workspace);
}

async function switchableChannelIn(ctx: QueryCtx, workspace: string) {
  if (!(await xpLevelsShownIn(ctx, workspace)) || !(await availableIn(ctx, workspace))) return null;
  return (await settingsOf(ctx, workspace)).announcementChannel;
}

async function lastWeeksPostOf(ctx: QueryCtx, workspace: string, thisMonday: DayKey): Promise<MondayPost> {
  const compared = wholeWeekBefore(thisMonday);
  const board = await workspaceGroupsBoardOf(ctx, workspace, compared);
  const groups = board.rows.filter(({ position, kudos }) => position <= groupsPosted && kudos > 0).map(({ rank, name, perMember }) => ({ rank, name, perMember }));
  return { groups, mostImproved: board.mostImproved?.name ?? null, givers: await giversIn(ctx, workspace, compared.now) };
}

async function couldNotPostIn(ctx: QueryCtx, workspace: string, channel: string) {
  const latest = await ctx.db
    .query("mondayPostClaims")
    .withIndex("by_workspace_week", (q) => q.eq("workspace", workspace))
    .order("desc")
    .first();
  return latest?.outcome === "cant-post" && latest.channel === channel;
}

function claimOf(ctx: QueryCtx, workspace: string, week: DayKey) {
  return ctx.db
    .query("mondayPostClaims")
    .withIndex("by_workspace_week", (q) => q.eq("workspace", workspace).eq("week", week))
    .unique();
}

function settingsRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("mondayPostSettings")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

function zoneOf({ timeZone }: Admin) {
  return timeZone ?? "UTC";
}

function dayAfter(day: DayKey, days: number): DayKey {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
}
