import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpRecordedEventValidator } from "../bus/events";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import type { Period } from "../leaderboard/periods";
import { everyoneBoardOf, type EveryoneBoardView } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { questsShownTo } from "../quests/flag";
import { activeJourneyOf, type JourneyStepFacts } from "../quests/journey";
import { thisWeeksQuestsOf, type WeeklyQuests } from "../quests/weekly";
import { progressSettingsOf, type ProgressSettings } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { unlocksShownTo } from "../unlocks/launch";
import { unlocksHomeOf, type UnlocksHome } from "../unlocks/unlocks";
import { adminsIn, chatUserOf, lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { isOpened, whenOpened } from "./unlockFilter";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("leaderboard"), v.literal("settings"), v.literal("admin"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type ShownTab =
  | { tab: "profile"; progression: ToldProgression | null; unlocks: UnlocksHome | null; quests: WeeklyQuests | null; journey: JourneyStepFacts[] | null }
  | { tab: "leaderboard"; period: Period; board: EveryoneBoardView }
  | { tab: "settings"; onTheBoards: boolean | null; progress: ProgressSettings | null }
  | { tab: "admin"; announcementChannel: string | null };

export type ShownHome = { tabs: HomeTab[]; shown: ShownTab };

export type ToldProgression = Omit<ProgressionHome, "skillPoints"> & { skillPoints: number | null };

export type HomeMember = Extract<MemberFacts, { kind: "member" }>;

type Slices = { board: boolean; leaderboard: boolean; xp: boolean; unlocks: boolean; quests: boolean; admin: boolean };

type HomeSelection = { tab: HomeTab; period: Period };

const opensOn: HomeSelection = { tab: "profile", period: "week" };

type Door = { frontDoor: boolean };

const tabsBesideProfile: Array<{ tab: HomeTab; shownWith: (slices: Slices & Door) => boolean }> = [
  { tab: "leaderboard", shownWith: ({ leaderboard, frontDoor }) => leaderboard && !frontDoor },
  { tab: "settings", shownWith: ({ board, xp }) => board || xp },
  { tab: "admin", shownWith: ({ xp, admin }) => xp && admin },
];

export const shownHomeOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), frontDoor: v.boolean() },
  handler: async (ctx, { workspace, user, frontDoor }): Promise<ShownHome | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return null;
    const slices = await slicesShownTo(ctx, workspace, person);
    const tabs = tabsOf({ ...slices, frontDoor });
    if (tabs.length === 0) return null;
    const { tab, period } = await selectionOf(ctx, person.member);
    const viewer = { workspace, user, member: person.member };
    return { tabs, shown: await shownTabOf(ctx, viewer, slices, { tab: tabs.includes(tab) ? tab : "profile", period }) };
  },
});

export async function showHomeTab(ctx: MutationCtx, workspace: string, person: HomeMember, tab: HomeTab) {
  if (!tabsOf({ ...(await slicesShownTo(ctx, workspace, person)), frontDoor: false }).includes(tab)) return;
  await select(ctx, person.member, { ...(await selectionOf(ctx, person.member)), tab });
}

export async function selectLeaderboardPeriod(ctx: MutationCtx, member: MemberId, period: Period) {
  await select(ctx, member, { tab: "leaderboard", period });
}

export const refreshHomeOnXp = internalMutation({
  args: { event: xpRecordedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (await xpLevelsShownIn(ctx, event.workspace)) await republish(ctx, event.member);
  },
});

export const republishAdminsIn = internalMutation({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }): Promise<void> => {
    for (const user of await adminsIn(ctx, workspace)) await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { workspace, user });
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

export async function isLeaderboardShownTo(ctx: MutationCtx, workspace: string, member: MemberId) {
  return (await isEveryoneBoardShownTo(ctx, workspace, member)) && (await isLeaderboardOpenTo(ctx, member, await unlocksShownTo(ctx, member)));
}

async function slicesShownTo(ctx: MutationCtx, workspace: string, person: HomeMember): Promise<Slices> {
  const board = await isEveryoneBoardShownTo(ctx, workspace, person.member);
  const xp = await xpLevelsShownTo(ctx, person.member);
  const unlocks = await unlocksShownTo(ctx, person.member);
  const quests = await questsShownTo(ctx, person.member);
  return { board, leaderboard: board && (await isLeaderboardOpenTo(ctx, person.member, unlocks)), xp, unlocks, quests, admin: person.admin };
}

async function isLeaderboardOpenTo(ctx: QueryCtx, member: MemberId, unlocksShown: boolean) {
  return !unlocksShown || (await isOpened(ctx, member, "leaderboard"));
}

function tabsOf(slices: Slices & Door): HomeTab[] {
  const besideProfile = tabsBesideProfile.filter(({ shownWith }) => shownWith(slices)).map(({ tab }) => tab);
  return besideProfile.length === 0 ? [] : ["profile", ...besideProfile];
}

type Viewer = { workspace: string; user: string; member: MemberId };

async function shownTabOf(ctx: MutationCtx, viewer: Viewer, slices: Slices, { tab, period }: HomeSelection): Promise<ShownTab> {
  switch (tab) {
    case "profile":
      if (!slices.xp) return { tab, progression: null, unlocks: null, quests: null, journey: null };
      if (!slices.unlocks) return { tab, progression: await progressionHomeOf(ctx, viewer.member), unlocks: null, quests: null, journey: null };
      return {
        tab,
        progression: await toldProgressionOf(ctx, viewer.member),
        unlocks: await unlocksHomeOf(ctx, viewer.member),
        quests: slices.quests ? await openedQuestsOf(ctx, viewer.member) : null,
        journey: slices.quests ? await activeJourneyOf(ctx, viewer.member) : null,
      };
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

async function openedQuestsOf(ctx: MutationCtx, member: MemberId) {
  return (await isOpened(ctx, member, "quests")) ? thisWeeksQuestsOf(ctx, member, Date.now()) : null;
}

async function toldProgressionOf(ctx: QueryCtx, member: MemberId): Promise<ToldProgression> {
  const progression = await progressionHomeOf(ctx, member);
  return { ...progression, skillPoints: await whenOpened(ctx, member, "skillTree", progression.skillPoints) };
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
