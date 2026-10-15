import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { bookFactsOf, type AchievementFacts } from "../achievements/achievements";
import { achievementsApplyIn, achievementsShownTo } from "../achievements/flag";
import { xpRecordedEventValidator } from "../bus/events";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import type { Period } from "../leaderboard/periods";
import { everyoneBoardOf, type EveryoneBoardView } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { memberPerksOf, ownsEveryPerk, type MemberPerks } from "../progression/perks";
import { skillTreeShownTo } from "../progression/skillTree";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { questsShownTo } from "../quests/flag";
import { activateJourneyOf, journeyOf, type JourneyStepFacts } from "../quests/journey";
import { journeyCopyFor, type JourneyStepCopy } from "../quests/journeyCopy";
import { thisWeeksQuestsOf, unopenedCratesOf, type UnopenedCrate, type WeeklyQuests } from "../quests/weekly";
import { progressSettingsOf, type ProgressSettings } from "../progression/settings";
import { xpLevelsOnFor, xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { inventoryHomeOf, type InventoryHome } from "../store/inventory";
import { itemRefusalValidator, type ItemRefusal } from "../store/rows";
import { storeShownAndExposedTo } from "../store/visibility";
import { unlocksShownTo } from "../unlocks/launch";
import { namedFor, scheduled } from "../unlocks/schedule";
import { unlocksHomeOf, type UnlocksHome } from "../unlocks/unlocks";
import { coinsVisibleAndExposedTo } from "../wallet/visibility";
import { balanceOf } from "../wallet/wallet";
import { adminsIn, chatUserOf, lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { isOpened, whenOpened } from "./unlockFilter";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("leaderboard"), v.literal("book"), v.literal("skillTree"), v.literal("inventory"), v.literal("settings"), v.literal("admin"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type ShownTab =
  | { tab: "profile"; progression: ToldProgression | null; unlocks: UnlocksHome | null; quests: WeeklyQuests | null; earlierCrates: UnopenedCrate[] | null; journey: JourneyStepShown[] | null }
  | { tab: "leaderboard"; period: Period; board: EveryoneBoardView }
  | { tab: "book"; book: AchievementFacts; timeZone: string | undefined }
  | { tab: "skillTree"; perks: MemberPerks; coinsName: string }
  | { tab: "inventory"; balance: number; inventory: InventoryHome; kudosEmoji: string; refused: ItemRefusal | null }
  | { tab: "settings"; onTheBoards: boolean | null; progress: ProgressSettings | null; achievements: boolean }
  | { tab: "admin"; announcementChannel: string | null; achievements: boolean };

export type ShownHome = { tabs: HomeTab[]; shown: ShownTab };

export type ToldProgression = Omit<ProgressionHome, "skillPoints"> & { skillPoints: number | null; skillTreeTab: boolean; coins: number | null };

export type HomeMember = Extract<MemberFacts, { kind: "member" }>;

type Slices = { board: boolean; leaderboard: boolean; xp: boolean; unlocks: boolean; quests: boolean; book: boolean; skillTree: boolean; coins: boolean; store: boolean; admin: boolean; sharedSettings: boolean };

type HomeSelection = { tab: HomeTab; period: Period };

const opensOn: HomeSelection = { tab: "profile", period: "week" };

export type JourneyStepShown = JourneyStepFacts & JourneyStepCopy;

async function journeyShownTo(ctx: QueryCtx, member: MemberId): Promise<JourneyStepShown[]> {
  return Promise.all((await journeyOf(ctx, member)).map(async (facts) => ({ ...facts, ...(await journeyCopyFor(ctx, member, facts.step)) })));
}

type Door = { frontDoor: boolean };

const tabsBesideProfile: Array<{ tab: HomeTab; shownWith: (slices: Slices & Door) => boolean }> = [
  { tab: "leaderboard", shownWith: ({ leaderboard, frontDoor }) => leaderboard && !frontDoor },
  { tab: "book", shownWith: ({ book, frontDoor }) => book && !frontDoor },
  { tab: "skillTree", shownWith: ({ skillTree, frontDoor }) => skillTree && !frontDoor },
  { tab: "inventory", shownWith: ({ coins, store }) => coins && store },
  { tab: "settings", shownWith: ({ board, xp }) => board || xp },
  { tab: "admin", shownWith: ({ sharedSettings, admin }) => sharedSettings && admin },
];

export const shownHomeOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), frontDoor: v.boolean(), refused: v.optional(itemRefusalValidator) },
  handler: async (ctx, { workspace, user, frontDoor, refused }): Promise<ShownHome | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return null;
    const slices = await slicesShownTo(ctx, workspace, person);
    if (slices.quests) await activateJourneyOf(ctx, person.member);
    const tabs = tabsOf({ ...slices, frontDoor });
    if (tabs.length === 0) return null;
    const { tab, period } = await selectionOf(ctx, person.member);
    const viewer = { workspace, user, member: person.member };
    return { tabs, shown: await shownTabOf(ctx, viewer, slices, { tab: tabs.includes(tab) ? tab : "profile", period }, refused ?? null) };
  },
});

export async function showHomeTab(ctx: MutationCtx, workspace: string, person: HomeMember, tab: HomeTab): Promise<HomeSelection | null> {
  if (!tabsOf({ ...(await slicesShownTo(ctx, workspace, person)), frontDoor: false }).includes(tab)) return null;
  const selection = { ...(await selectionOf(ctx, person.member)), tab };
  await select(ctx, person.member, selection);
  return selection;
}

export async function selectLeaderboardPeriod(ctx: MutationCtx, member: MemberId, period: Period) {
  await select(ctx, member, { tab: "leaderboard", period });
}

export const refreshHomeOnXp = internalMutation({
  args: { event: xpRecordedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (await xpLevelsOnFor(ctx, event.member)) await republish(ctx, event.member);
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
  if (await xpLevelsOnFor(ctx, member)) await republish(ctx, member);
}

export async function republish(ctx: MutationCtx, member: MemberId, refused?: ItemRefusal) {
  await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { ...(await chatUserOf(ctx, member)), ...(refused !== undefined && { refused }) });
}

export async function isLeaderboardShownTo(ctx: MutationCtx, workspace: string, member: MemberId) {
  return (await isEveryoneBoardShownTo(ctx, workspace, member)) && (await isLeaderboardOpenTo(ctx, member, await unlocksShownTo(ctx, member)));
}

async function slicesShownTo(ctx: MutationCtx, workspace: string, person: HomeMember): Promise<Slices> {
  const board = await isEveryoneBoardShownTo(ctx, workspace, person.member);
  const xp = await xpLevelsShownTo(ctx, person.member);
  const unlocks = await unlocksShownTo(ctx, person.member);
  const quests = await questsShownTo(ctx, person.member);
  const book = unlocks && (await achievementsShownTo(ctx, person.member)) && (await isOpened(ctx, person.member, "book"));
  const skillTree = (await skillTreeShownTo(ctx, person.member)) && (await isOpened(ctx, person.member, "skillTree"));
  const coins = unlocks && (await coinsVisibleAndExposedTo(ctx, person.member));
  const store = unlocks && (await storeShownAndExposedTo(ctx, person.member));
  const sharedSettings = await xpLevelsShownIn(ctx, workspace);
  return { board, leaderboard: board && (await isLeaderboardOpenTo(ctx, person.member, unlocks)), xp, unlocks, quests, book, skillTree, coins, store, admin: person.admin, sharedSettings };
}

async function isLeaderboardOpenTo(ctx: QueryCtx, member: MemberId, unlocksShown: boolean) {
  return !unlocksShown || (await isOpened(ctx, member, "leaderboard"));
}

function tabsOf(slices: Slices & Door): HomeTab[] {
  const besideProfile = tabsBesideProfile.filter(({ shownWith }) => shownWith(slices)).map(({ tab }) => tab);
  return besideProfile.length === 0 ? [] : ["profile", ...besideProfile];
}

type Viewer = { workspace: string; user: string; member: MemberId };

async function shownTabOf(ctx: MutationCtx, viewer: Viewer, slices: Slices, { tab, period }: HomeSelection, refused: ItemRefusal | null): Promise<ShownTab> {
  switch (tab) {
    case "profile":
      if (!slices.xp) return { tab, progression: null, unlocks: null, quests: null, earlierCrates: null, journey: null };
      if (!slices.unlocks) return { tab, progression: { ...(await progressionHomeOf(ctx, viewer.member)), skillTreeTab: false, coins: null }, unlocks: null, quests: null, earlierCrates: null, journey: null };
      return {
        tab,
        progression: await toldProgressionOf(ctx, viewer.member, slices),
        unlocks: namedForStore(await unlocksHomeOf(ctx, viewer.member), slices.store),
        quests: slices.quests ? await openedQuestsOf(ctx, viewer.member) : null,
        earlierCrates: slices.quests ? await openedEarlierCratesOf(ctx, viewer.member) : null,
        journey: slices.quests ? await journeyShownTo(ctx, viewer.member) : null,
      };
    case "leaderboard":
      return { tab, period, board: await everyoneBoardOf(ctx, viewer.workspace, viewer.user, period) };
    case "book":
      return { tab, book: await bookFactsOf(ctx, viewer.member), timeZone: (await ctx.db.get(viewer.member))?.timeZone };
    case "skillTree":
      return { tab, perks: await memberPerksOf(ctx, viewer.member), coinsName: namedFor(scheduled("coins"), slices.store).name };
    case "inventory":
      return { tab, balance: await balanceOf(ctx, viewer.member), inventory: await inventoryHomeOf(ctx, viewer.member), kudosEmoji: (await settingsOf(ctx, viewer.workspace)).kudosEmoji, refused };
    case "settings":
      return {
        tab,
        onTheBoards: slices.board ? await isOnTheBoards(ctx, viewer.member) : null,
        progress: slices.xp ? await progressSettingsOf(ctx, viewer.member) : null,
        achievements: await achievementsApplyIn(ctx, viewer.workspace),
      };
    case "admin":
      return { tab, announcementChannel: (await settingsOf(ctx, viewer.workspace)).announcementChannel, achievements: await achievementsApplyIn(ctx, viewer.workspace) };
  }
}

function namedForStore({ ready, next }: UnlocksHome, storeShown: boolean): UnlocksHome {
  return { ready: ready.map((entry) => namedFor(entry, storeShown)), next: next === null ? null : namedFor(next, storeShown) };
}

async function openedQuestsOf(ctx: MutationCtx, member: MemberId) {
  return (await isOpened(ctx, member, "quests")) ? thisWeeksQuestsOf(ctx, member, Date.now()) : null;
}

async function openedEarlierCratesOf(ctx: MutationCtx, member: MemberId) {
  return (await isOpened(ctx, member, "quests")) ? unopenedCratesOf(ctx, member, Date.now()) : null;
}

async function toldProgressionOf(ctx: QueryCtx, member: MemberId, { skillTree: skillTreeTab, coins }: Slices): Promise<ToldProgression> {
  const progression = await progressionHomeOf(ctx, member);
  const nothingToBuy = skillTreeTab && ownsEveryPerk(await memberPerksOf(ctx, member));
  const skillPoints = nothingToBuy ? null : await whenOpened(ctx, member, "skillTree", progression.skillPoints);
  return { ...progression, skillPoints, skillTreeTab, coins: coins ? await balanceOf(ctx, member) : null };
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
