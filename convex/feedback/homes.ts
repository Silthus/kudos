import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { bookFactsOf, type AchievementFacts } from "../achievements/achievements";
import { achievementsApplyIn, achievementsShownTo } from "../achievements/flag";
import { groupModeShownTo, type GroupModeFacts } from "../groups/groupMode";
import { avatarChoiceOf, type AvatarChoice } from "../hoggies/avatar";
import { crateStoreOf, waitingCratesOf, type CrateStore } from "../hoggies/boughtCrates";
import { hoggiesOf, type HoggiesHome } from "../hoggies/collection";
import { teamsCompletedBy } from "../stickers/completionRecords";
import { teamSpiritShownTo } from "../stickers/flag";
import { crateStoreShownTo, crestsShownTo, hoggiesShownTo } from "../hoggies/flag";
import { xpRecordedEventValidator } from "../bus/events";
import { groupsShownAndExposedTo, type GroupId } from "../groups/groups";
import { groupChoiceOf, type GroupChoice } from "../groups/pick";
import type { GroupsBoard } from "../leaderboard/groupsBoard";
import type { MyGroupBoardView } from "../leaderboard/myGroupBoard";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import type { Period } from "../leaderboard/periods";
import { mondayPostSwitchShownTo, type MondayPostSwitch } from "../leaderboard/mondayPost";
import { welcomeNudgeSwitchOf } from "./welcomeNudge";
import { thoughtfulGiversShownTo } from "../album/thoughtfulGivers";
import { everyoneBoardOf, type EveryoneBoardView } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { messageSettingsShownTo } from "../messageSettings/flag";
import { messageSettingsOf, notificationSwitchesOf, type MessageSetting, type NotificationSwitches } from "../messageSettings/messageSettings";
import { memberPerksOf, ownsEveryPerk, type MemberPerks } from "../progression/perks";
import { skillTreeShownTo } from "../progression/skillTree";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { questsShownTo } from "../quests/flag";
import { earlierGroupCratesOf, groupQuestFor, groupQuestShownAndExposedTo, type GroupQuest, type WaitingGroupCrate } from "../quests/groupQuest";
import { activateJourneyOf, journeyOf, type JourneyStepFacts } from "../quests/journey";
import { journeyCopyFor, type JourneyStepCopy } from "../quests/journeyCopy";
import { thisWeeksQuestsOf, unopenedCratesOf, type UnopenedCrate, type WeeklyQuests } from "../quests/weekly";
import { xpLevelsOnFor, xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { customKudosEmojiPickerFor, type CustomKudosEmojiPicker } from "../store/customKudosEmoji";
import { inventoryHomeOf, type InventoryHome } from "../store/inventory";
import { type ItemRefusal } from "../store/rows";
import { homeRefusalValidator, type HomeRefusal } from "./homeRefusal";
import { storeShownAndExposedTo } from "../store/visibility";
import { unlocksShownTo } from "../unlocks/launch";
import { namedFor, scheduled, type ScheduledFeature, type StoreNaming } from "../unlocks/schedule";
import { unlocksHomeOf, type UnlocksHome } from "../unlocks/unlocks";
import { coinsVisibleAndExposedTo } from "../wallet/visibility";
import { balanceOf } from "../wallet/wallet";
import { adminsPageIn, chatUserOf, lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { isOpened, whenOpened, whenShipped } from "./unlockFilter";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("leaderboard"), v.literal("book"), v.literal("skillTree"), v.literal("inventory"), v.literal("settings"), v.literal("admin"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type ShownTab =
  | {
      tab: "profile";
      progression: ToldProgression | null;
      unlocks: UnlocksHome | null;
      quests: WeeklyQuests | null;
      groupQuest: GroupQuest | null;
      earlierCrates: UnopenedCrate[] | null;
      earlierGroupCrates: WaitingGroupCrate[] | null;
      journey: JourneyStepShown[] | null;
      hoggies: HoggiesShown | null;
      boughtCrates: string[] | null;
      thoughtfulGivers: number | null;
    }
  | { tab: "leaderboard"; period: Period; board: EveryoneBoardView; groups: GroupsBoard<GroupId> | null; myGroup: MyGroupBoardView | null }
  | { tab: "book"; book: AchievementFacts; timeZone: string | undefined }
  | { tab: "skillTree"; perks: MemberPerks; coinsName: string }
  | { tab: "inventory"; balance: number; inventory: InventoryHome; kudosEmoji: string; refused: ItemRefusal | null }
  | { tab: "settings"; onTheBoards: boolean | null; progress: NotificationSwitches | null; messages: MessageSetting[] | null; achievements: boolean; channelPicked: boolean; groups: GroupChoice | null }
  | { tab: "admin"; announcementChannel: string | null; achievements: boolean; groupMode: GroupModeFacts | null; mondayPost: MondayPostSwitch | null; welcomeNudge: boolean | null; customKudosEmoji: CustomKudosEmojiPicker | null };

export type ShownHome = { tabs: HomeTab[]; shown: ShownTab };

export type CrateStoreShown = CrateStore & { short: number | null };

export type HoggiesShown = HoggiesHome & { crateStore: CrateStoreShown | null; avatar: AvatarChoice | null };

export type ToldProgression = Omit<ProgressionHome, "skillPoints"> & { skillPoints: number | null; skillTreeTab: boolean; coins: number | null };

export type HomeMember = Extract<MemberFacts, { kind: "member" }>;

type Slices = {
  board: boolean;
  leaderboard: boolean;
  xp: boolean;
  unlocks: boolean;
  quests: boolean;
  book: boolean;
  skillTree: boolean;
  coins: boolean;
  store: boolean;
  messages: boolean;
  admin: boolean;
  sharedSettings: boolean;
  groups: GroupChoice | null;
};

type HomeSelection = { tab: HomeTab; period: Period };

const adminsRepublishedPerPage = 100;
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
  { tab: "settings", shownWith: ({ board, xp, messages, groups }) => board || xp || messages || groups !== null },
  { tab: "admin", shownWith: ({ sharedSettings, admin }) => sharedSettings && admin },
];

export const shownHomeOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), frontDoor: v.boolean(), refused: v.optional(homeRefusalValidator) },
  handler: async (ctx, { workspace, user, frontDoor, refused }): Promise<ShownHome | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return null;
    const slices = await slicesShownTo(ctx, workspace, person);
    if (slices.quests) await activateJourneyOf(ctx, person.member);
    const tabs = tabsOf({ ...slices, frontDoor });
    if (tabs.length === 0) return null;
    const { tab, period } = await selectionOf(ctx, person.member);
    const viewer = { workspace, user, member: person.member, timeZone: person.timeZone, admin: person.admin };
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
  args: { workspace: v.string(), cursor: v.optional(v.string()) },
  handler: async (ctx, { workspace, cursor }): Promise<void> => {
    const { admins, continueCursor } = await adminsPageIn(ctx, workspace, cursor ?? null, adminsRepublishedPerPage);
    for (const user of admins) await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { workspace, user });
    if (continueCursor !== null) await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace, cursor: continueCursor });
  },
});

export async function republishOnRoleChange(ctx: MutationCtx, before: MemberFacts | undefined, after: MemberFacts | undefined) {
  if (before === undefined || after === undefined || roleOf(before) === roleOf(after)) return;
  const member = before.kind === "member" ? before.member : after.kind === "member" ? after.member : null;
  if (member === null) return;
  if (await xpLevelsOnFor(ctx, member)) await republish(ctx, member);
}

export async function republish(ctx: MutationCtx, member: MemberId, refused?: HomeRefusal) {
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
  const messages = await messageSettingsShownTo(ctx, person.member);
  const sharedSettings = await xpLevelsShownIn(ctx, workspace);
  const groups = (await groupsShownAndExposedTo(ctx, person.member)) ? await groupChoiceOf(ctx, person.member) : null;
  return { board, leaderboard: board && (await isLeaderboardOpenTo(ctx, person.member, unlocks)), xp, unlocks, quests, book, skillTree, coins, store, messages, admin: person.admin, sharedSettings, groups };
}

async function isLeaderboardOpenTo(ctx: QueryCtx, member: MemberId, unlocksShown: boolean) {
  return !unlocksShown || (await isOpened(ctx, member, "leaderboard"));
}

function tabsOf(slices: Slices & Door): HomeTab[] {
  const besideProfile = tabsBesideProfile.filter(({ shownWith }) => shownWith(slices)).map(({ tab }) => tab);
  return besideProfile.length === 0 ? [] : ["profile", ...besideProfile];
}

type Viewer = { workspace: string; user: string; member: MemberId; timeZone: string | undefined; admin: boolean };

async function shownTabOf(ctx: MutationCtx, viewer: Viewer, slices: Slices, { tab, period }: HomeSelection, refused: HomeRefusal | null): Promise<ShownTab> {
  switch (tab) {
    case "profile": {
      const thoughtfulGivers = await thoughtfulGiversShownTo(ctx, viewer);
      if (!slices.xp) return { tab, progression: null, unlocks: null, quests: null, ...noGroupQuest, earlierCrates: null, journey: null, hoggies: null, boughtCrates: null, thoughtfulGivers };
      if (!slices.unlocks) return { tab, progression: await levelsOnlyProgressionOf(ctx, viewer.member), unlocks: null, quests: null, ...noGroupQuest, earlierCrates: null, journey: null, hoggies: null, boughtCrates: null, thoughtfulGivers };
      return {
        tab,
        progression: await toldProgressionOf(ctx, viewer.member, slices),
        unlocks: namedForStore(await unlocksHomeOf(ctx, viewer.member), storeNamingOf(slices)),
        quests: slices.quests ? await openedQuestsOf(ctx, viewer.member) : null,
        ...(slices.quests ? await openedGroupQuestOf(ctx, viewer.member) : noGroupQuest),
        earlierCrates: slices.quests ? await openedEarlierCratesOf(ctx, viewer.member) : null,
        journey: slices.quests ? await journeyShownTo(ctx, viewer.member) : null,
        hoggies: await hoggiesInTheBookOf(ctx, viewer.member, slices, refused),
        boughtCrates: (await hoggiesShownTo(ctx, viewer.member)) ? await waitingCratesOf(ctx, viewer.member) : null,
        thoughtfulGivers,
      };
    }
    case "leaderboard":
      return { tab, period, board: await everyoneBoardOf(ctx, viewer.workspace, viewer.user, period), groups: null, myGroup: null };
    case "book":
      return { tab, book: await bookFactsOf(ctx, viewer.member), timeZone: (await ctx.db.get(viewer.member))?.timeZone };
    case "skillTree":
      return { tab, perks: await memberPerksOf(ctx, viewer.member), coinsName: namedFor(scheduled("coins"), storeNamingOf(slices)).name };
    case "inventory":
      return { tab, balance: await balanceOf(ctx, viewer.member), inventory: await inventoryHomeOf(ctx, viewer.member), kudosEmoji: (await settingsOf(ctx, viewer.workspace)).kudosEmoji, refused: itemRefusalIn(refused) };
    case "settings":
      return {
        tab,
        onTheBoards: slices.board ? await isOnTheBoards(ctx, viewer.member) : null,
        progress: slices.xp && !slices.messages ? await notificationSwitchesOf(ctx, viewer.member) : null,
        messages: slices.messages ? await applyingMessageSettingsOf(ctx, viewer.member) : null,
        achievements: await achievementsApplyIn(ctx, viewer.workspace),
        groups: slices.groups,
        channelPicked: (await settingsOf(ctx, viewer.workspace)).announcementChannel !== null,
      };
    case "admin":
      return {
        tab,
        announcementChannel: (await settingsOf(ctx, viewer.workspace)).announcementChannel,
        achievements: await achievementsApplyIn(ctx, viewer.workspace),
        groupMode: await groupModeShownTo(ctx, viewer.workspace, viewer),
        mondayPost: await mondayPostSwitchShownTo(ctx, viewer.workspace, viewer),
        welcomeNudge: await welcomeNudgeSwitchOf(ctx, viewer),
        customKudosEmoji: await customKudosEmojiPickerFor(ctx, viewer.workspace, viewer),
      };
  }
}

function storeNamingOf({ store }: Slices): StoreNaming {
  return { storeShown: store };
}

function namedForStore({ ready, next }: UnlocksHome, naming: StoreNaming): UnlocksHome {
  const named = (entry: ScheduledFeature) => namedFor(entry, naming);
  return { ready: ready.map(named), next: next === null ? null : named(next) };
}

async function hoggiesInTheBookOf(ctx: QueryCtx, member: MemberId, { book, coins }: Slices, refused: HomeRefusal | null): Promise<HoggiesShown | null> {
  if (!book || !(await hoggiesShownTo(ctx, member))) return null;
  const hoggies = await hoggiesOf(ctx, member, { crests: await crestsShownTo(ctx, member) }, await crestsOfCompletedPages(ctx, member));
  return { ...hoggies, crateStore: coins && (await crateStoreShownTo(ctx, member)) ? await crateStoreToldTo(ctx, member, refused) : null, avatar: await avatarChoiceOf(ctx, member) };
}

async function crestsOfCompletedPages(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  return (await teamSpiritShownTo(ctx, member)) ? teamsCompletedBy(ctx, member) : [];
}

async function crateStoreToldTo(ctx: QueryCtx, member: MemberId, refused: HomeRefusal | null): Promise<CrateStoreShown | null> {
  const store = await crateStoreOf(ctx, member);
  if (store === null) return null;
  const refusedForCoins = refused !== null && "crate" in refused && refused.reason === "no-coins";
  return { ...store, short: refusedForCoins ? store.price - (await balanceOf(ctx, member)) : null };
}

function itemRefusalIn(refused: HomeRefusal | null): ItemRefusal | null {
  return refused !== null && "item" in refused ? refused : null;
}

async function applyingMessageSettingsOf(ctx: QueryCtx, member: MemberId) {
  return (await messageSettingsOf(ctx, member)).filter(({ applies }) => applies);
}

async function openedQuestsOf(ctx: MutationCtx, member: MemberId) {
  return (await isOpened(ctx, member, "quests")) ? thisWeeksQuestsOf(ctx, member, Date.now()) : null;
}

const noGroupQuest = { groupQuest: null, earlierGroupCrates: null };

async function openedGroupQuestOf(ctx: MutationCtx, member: MemberId) {
  if (!(await isOpened(ctx, member, "quests")) || !(await groupQuestShownAndExposedTo(ctx, member))) return noGroupQuest;
  const now = Date.now();
  return { groupQuest: await groupQuestFor(ctx, member, now), earlierGroupCrates: await earlierGroupCratesOf(ctx, member, now) };
}

async function openedEarlierCratesOf(ctx: MutationCtx, member: MemberId) {
  return (await isOpened(ctx, member, "quests")) ? unopenedCratesOf(ctx, member, Date.now()) : null;
}

async function levelsOnlyProgressionOf(ctx: QueryCtx, member: MemberId): Promise<ToldProgression> {
  const progression = await progressionHomeOf(ctx, member);
  return { ...progression, skillPoints: await whenShipped(ctx, member, "skillTree", progression.skillPoints), skillTreeTab: false, coins: null };
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
