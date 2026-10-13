import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import type { Period } from "../leaderboard/periods";
import { everyoneBoardOf, type EveryoneBoardView } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { progressSettingsOf, type ProgressSettings } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { chatUserOf, lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("leaderboard"), v.literal("settings"), v.literal("admin"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type ShownTab =
  | { tab: "profile"; progression: ProgressionHome | null }
  | { tab: "leaderboard"; period: Period; board: EveryoneBoardView }
  | { tab: "settings"; onTheBoards: boolean | null; progress: ProgressSettings | null }
  | { tab: "admin"; announcementChannel: string | null };

export type ShownHome = { tabs: HomeTab[]; shown: ShownTab };

export type HomeMember = Extract<MemberFacts, { kind: "member" }>;

type Slices = { board: boolean; xp: boolean; admin: boolean };

type HomeSelection = { tab: HomeTab; period: Period };

const opensOn: HomeSelection = { tab: "profile", period: "week" };

const tabsBesideProfile: Array<{ tab: HomeTab; shownWith: (slices: Slices) => boolean }> = [
  { tab: "leaderboard", shownWith: ({ board }) => board },
  { tab: "settings", shownWith: ({ board, xp }) => board || xp },
  { tab: "admin", shownWith: ({ xp, admin }) => xp && admin },
];

export const shownHomeOf = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<ShownHome | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return null;
    const slices = await slicesShownTo(ctx, workspace, person);
    const tabs = tabsOf(slices);
    if (tabs.length === 0) return null;
    const { tab, period } = await selectionOf(ctx, person.member);
    const viewer = { workspace, user, member: person.member };
    return { tabs, shown: await shownTabOf(ctx, viewer, slices, { tab: tabs.includes(tab) ? tab : "profile", period }) };
  },
});

export async function showHomeTab(ctx: MutationCtx, workspace: string, person: HomeMember, tab: HomeTab) {
  if (!tabsOf(await slicesShownTo(ctx, workspace, person)).includes(tab)) return;
  await select(ctx, person.member, { ...(await selectionOf(ctx, person.member)), tab });
}

export async function selectLeaderboardPeriod(ctx: MutationCtx, member: MemberId, period: Period) {
  await select(ctx, member, { tab: "leaderboard", period });
}

export const refreshHomeOnLevel = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (await xpLevelsShownIn(ctx, event.workspace)) await republish(ctx, event.member);
  },
});

export async function republishOnRoleChange(ctx: MutationCtx, before: MemberFacts | undefined, after: MemberFacts | undefined) {
  if (before === undefined || after === undefined || roleOf(before) === roleOf(after)) return;
  const member = before.kind === "member" ? before.member : after.kind === "member" ? after.member : null;
  if (member === null) return;
  const { workspace } = await chatUserOf(ctx, member);
  if (await xpLevelsShownIn(ctx, workspace)) await republish(ctx, member);
}

export async function republish(ctx: MutationCtx, member: MemberId) {
  await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, await chatUserOf(ctx, member));
}

async function slicesShownTo(ctx: MutationCtx, workspace: string, person: HomeMember): Promise<Slices> {
  return {
    board: await isEveryoneBoardShownTo(ctx, workspace, person.member),
    xp: await xpLevelsShownTo(ctx, person.member),
    admin: person.admin,
  };
}

function tabsOf(slices: Slices): HomeTab[] {
  const besideProfile = tabsBesideProfile.filter(({ shownWith }) => shownWith(slices)).map(({ tab }) => tab);
  return besideProfile.length === 0 ? [] : ["profile", ...besideProfile];
}

type Viewer = { workspace: string; user: string; member: MemberId };

async function shownTabOf(ctx: QueryCtx, viewer: Viewer, slices: Slices, { tab, period }: HomeSelection): Promise<ShownTab> {
  switch (tab) {
    case "profile":
      return { tab, progression: slices.xp ? await progressionHomeOf(ctx, viewer.member) : null };
    case "leaderboard":
      return { tab, period, board: await everyoneBoardOf(ctx, viewer.workspace, viewer.user, period) };
    case "settings":
      return {
        tab,
        onTheBoards: slices.board ? await isOnTheBoards(ctx, viewer.member) : null,
        progress: slices.xp ? await progressSettingsOf(ctx, viewer.member) : null,
      };
    case "admin":
      return { tab, announcementChannel: (await settingsOf(ctx, viewer.workspace)).announcementChannel };
  }
}

function roleOf(person: MemberFacts) {
  return person.kind === "member" && person.admin ? "admin" : person.kind;
}

async function selectionOf(ctx: QueryCtx, member: MemberId): Promise<HomeSelection> {
  const row = await selectionRow(ctx, member);
  return row === null ? opensOn : { tab: row.tab, period: row.period };
}

async function select(ctx: MutationCtx, member: MemberId, selection: HomeSelection) {
  const row = await selectionRow(ctx, member);
  if (row === null) await ctx.db.insert("homeSelections", { member, ...selection });
  else if (row.tab !== selection.tab || row.period !== selection.period) await ctx.db.patch(row._id, selection);
}

function selectionRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("homeSelections")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
