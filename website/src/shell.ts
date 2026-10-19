import type { Feature } from "../../convex/unlocks/feature";
import type { Quest, WeeklyQuest } from "../../convex/quests/step";
import type { PerkId } from "../../convex/progression/tree";
import type { AdminProfileLinkAnswer, AvatarAnswer, CommandAnswer, CompanyProfileLinkAnswer, CrateAnswer, CrateOpenAnswer, CratePurchaseAnswer, GroupPickAnswer, ItemPurchaseAnswer, MessageSettingAnswer, PurchaseAnswer, SwapAnswer, VisibilityAnswer, WorkspaceSettingsAnswer } from "../../convex/website/commands";
import type { MessageKind, MessagePlace, SettingsAnswer } from "../../convex/website/settings";
import type { EmojiMappingAnswer, EmojiMappings, EmojiMappingsRead as EmojiMappingsReadAnswer, ShownTarget } from "../../convex/website/emojiMappings";
import type { AppEmojisRead as AppEmojisReadAnswer, MyEmojiMappingAnswer, SlackEmojiMatchesRead as SlackEmojiMatchesReadAnswer } from "../../convex/website/emojiWizard";
import type { Denial } from "../../convex/website/memberQuery";

import type { Drop } from "./crates/drops";

export type { Drop, Rarity } from "./crates/drops";
import type { FeatureCard, JourneyStep, MemberProfile, MyProfile } from "../../convex/website/profile";
import type { QuestsAnswer } from "../../convex/website/quests";
import type { BookAnswer } from "../../convex/website/book";
import type { ProfileCardAnswer } from "../../convex/website/profileCard";
import type { MySkillTree } from "../../convex/website/skillTree";
import type { GroupBoards, GroupsBoardShown } from "../../convex/website/groupBoards";
import type { Leaderboard as EveryoneBoard, MyLeaderboard as MyEveryoneBoard } from "../../convex/website/leaderboard";
import { inventoryFixtures } from "./inventoryFixtures";
import { fixturePackOpenOf, fixtureStanding } from "./collectionFixtures";
import { albumFixtures, fixturePackOpeningOf, fixturePutAllIn, fixturePutInOf, fixtureUnlockOf } from "./album/albumFixtures";
import type { PackOpenReply, PutAllInReply, PutInReply, SeenReply, UnlockReply } from "./album/answer";

export type { Avatar, Face, FeatureCard, InventoryItem, ItemSource, JourneyStep, MemberInventory, MemberProfile, PageWaits, Progression } from "../../convex/website/profile";
export type { GroupQuestCard, QuestReward, QuestsAnswer, QuestSlot, WaitingCrate, WeekSwap } from "../../convex/website/quests";
export type { BookAnswer, LadderCard, TierCard, TierReward } from "../../convex/website/book";
export type { TierId } from "../../convex/achievements/ladders";
export type { Medal } from "../../convex/profileCard/profileCard";
export type { MySkillTree, PerkNode, SkillTreeAnswer, TreeRow } from "../../convex/website/skillTree";
export type { LeaderboardRow } from "../../convex/website/leaderboard";
export type { GroupBoards, GroupsBoardShown, MyGroupBoards, MyGroupBoardShown } from "../../convex/website/groupBoards";
export type { GroupId } from "../../convex/groups/groups";
export type { Period } from "../../convex/leaderboard/periods";
export type { Peer } from "../../convex/leaderboard/peer";
export type { CommandAnswer, ItemPurchaseAnswer, ItemPurchaseRefusal, PurchaseAnswer, PurchaseRefusal, SwapAnswer } from "../../convex/website/commands";
export type { AdminProfiles, CompanyProfileSetting, GroupChoice, MessageKind, MessagePlace, MessageSetting, MySettings, ProfileChoice, WorkspaceSettingsPart } from "../../convex/website/settings";
export type { Feature } from "../../convex/unlocks/feature";
export type { GroupQuestCrate, Quest, WeeklyQuest } from "../../convex/quests/step";
export type { Activity, ActivityEntry, Found, HugGiven, HugReceived, KudosGiven, KudosReceived, LevelUp, Message, MyActivity, MyRecentKudos, MySpotlight, Person, QuestDone, RecentKudos, Segment, Spotlight } from "../../convex/website/activity";

export type GroupsBoardRow = GroupsBoardShown["rows"][number];

export type Leaderboard = EveryoneBoard & Omit<GroupBoards, "kind">;

export type MyLeaderboard = Exclude<MyEveryoneBoard, EveryoneBoard> | Leaderboard;

export type OpenAnswer = CommandAnswer | CrateAnswer | Denial;

export type { AppliedReward } from "../../convex/progression/rewards";
export type { CrateAnswer } from "../../convex/website/commands";

export type Purchase = { perk: PerkId; request: string };

export type BuyAnswer = PurchaseAnswer | Denial;

export type CratePurchaseReply = CratePurchaseAnswer | Denial;

export type CrateOpenReply = CrateOpenAnswer | Denial;

export type ItemPurchase = { item: string; request: string };

export type ItemBuyAnswer = ItemPurchaseAnswer | Denial;

export type SwapReply = SwapAnswer | Denial;

export type VisibilityReply = VisibilityAnswer | Denial;

export type MessageSettingReply = MessageSettingAnswer | Denial;

export type GroupPickReply = GroupPickAnswer | Denial;

export type CompanyProfileLinkReply = CompanyProfileLinkAnswer | Denial;

export type AdminProfileLinkReply = AdminProfileLinkAnswer | Denial;

export type WorkspaceSettingsReply = WorkspaceSettingsAnswer | Denial;

export type WorkspaceSettingsChange = { baseAllowance: number; kudosEmoji: string; hugBudget: number };

export type AdminLinkTarget = number | "none" | null;

export type AvatarReply = AvatarAnswer | Denial;

export type MySettingsAnswer = SettingsAnswer | Denial;

export type { EmojiMappings };

export type ShownMappingTarget = ShownTarget;

export type EmojiPlaceChoice = ShownTarget | { kind: "unmapped" };

export type EmojiMappingsAnswer = EmojiMappingsReadAnswer | Denial;

export type EmojiMappingReply = EmojiMappingAnswer | Denial;

export type SlackEmojiMatchesAnswer = SlackEmojiMatchesReadAnswer | Denial;

export type AppEmojisAnswer = AppEmojisReadAnswer | Denial;

export type MyEmojiMappingReply = MyEmojiMappingAnswer | Denial;

export type MyQuests = QuestsAnswer | Denial;

export type MyBook = BookAnswer | Denial;

export type MyProfileCard = ProfileCardAnswer | Denial;

export type Visitor = MyProfile | { kind: "loading" } | { kind: "connecting" } | { kind: "sign-in-unfinished" };

export type ShellState = Visitor | { kind: "broken" };

export type ShellActions = { signIn(returnTo: string): void; signOut(): void; openFeature(feature: Feature): Promise<OpenAnswer>; openQuestCrate(quest: Quest): Promise<OpenAnswer>; buyPerk(purchase: Purchase): Promise<BuyAnswer>; buyItem(purchase: ItemPurchase): Promise<ItemBuyAnswer>; buyCrate(next: number): Promise<CratePurchaseReply>; openCrate(crate: string): Promise<CrateOpenReply>; setBoardVisibility(visible: boolean): Promise<VisibilityReply>; setMessageSetting(kind: MessageKind, place: MessagePlace): Promise<MessageSettingReply>; pickPrimaryGroup(group: string): Promise<GroupPickReply>; linkMyCompanyProfile(profile: number | null): Promise<CompanyProfileLinkReply>; linkCompanyProfile(member: string, profile: AdminLinkTarget): Promise<AdminProfileLinkReply>; setWorkspaceSettings(settings: WorkspaceSettingsChange): Promise<WorkspaceSettingsReply>; mapSlackEmoji(emoji: string, to: EmojiPlaceChoice): Promise<EmojiMappingReply>; mapMyEmoji(emoji: string, to: string): Promise<MyEmojiMappingReply>; setAvatar(hoggie: string | null): Promise<AvatarReply>; swapQuest(quest: WeeklyQuest): Promise<SwapReply>; openThoughtfulPack(pack: string): Promise<PackOpenReply>; putIn(item: string): Promise<PutInReply>; putAllIn(): Promise<PutAllInReply>; unlockTeamSticker(team: string): Promise<UnlockReply>; markEmojisSeen(ids: string[]): Promise<SeenReply> };

const member: MemberProfile = {
  kind: "member",
  name: "Sam Example",
  face: { kind: "initials", initials: "SE" },
  kudosEmoji: "taco",
  allowance: { left: 1, base: 3, refillsAt: Date.parse("2026-10-14T00:00:00Z") },
  thisWeek: { given: 2, received: 1 },
  lifetime: { given: 14, received: 9 },
  chatUrl: "https://app.slack.com/client/T1",
  leaderboard: { kind: "off" },
  features: null,
  journey: null,
  progression: null,
  skillPoints: null,
  coins: null,
  inventory: null,
  groups: false,
  settings: false,
};

const readyAt = Date.parse("2026-10-12T09:00:00Z");

const openedAt = Date.parse("2026-10-13T09:00:00Z");

const bookFeature = { feature: "book", name: "Book", opens: "your achievements", level: 1, seen: "c4f8a1" } as const;

const leaderboardFeature = { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 2, seen: "5e3a0c" } as const;

const questsFeature = { feature: "quests", name: "Quests", opens: "your weekly quests", level: 3, seen: "4c8e1f" } as const;

const skillTreeFeature = { feature: "skillTree", name: "Skill tree", opens: "the tree and your first skill point", level: 5, seen: "9b71d2" } as const;

const coinsFeature = { feature: "coins", name: "Coins and inventory", opens: "your wallet, the store and your kudos emoji", level: 6, seen: "e5a6b7" } as const;

const locked = { state: "locked", readyAt: null, openedAt: null } as const;

const ready = { state: "ready", readyAt, openedAt: null } as const;

const opened = { state: "open", readyAt, openedAt } as const;

const onTheUnlockPath = (...features: FeatureCard[]): Pick<MemberProfile, "leaderboard" | "features"> => ({
  leaderboard: leaderboardOn(features.find(({ feature }) => feature === "leaderboard")),
  features,
});

function leaderboardOn(card: FeatureCard | undefined): MemberProfile["leaderboard"] {
  if (card === undefined) return { kind: "off" };
  if (card.state === "locked") return { kind: "locked", level: card.level };
  return { kind: card.state };
}

const memberWithTheBoard: MemberProfile = { ...member, leaderboard: { kind: "open" } };

const memberWaitingForTheBoard: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...locked }) };

const memberWithTheBoardReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...ready }, { ...skillTreeFeature, ...locked }) };

const memberWithTheBoardOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...locked }) };

const memberWithTheQuestsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...questsFeature, ...ready }) };

const memberWithTheQuestsOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...questsFeature, ...opened }) };

const memberWithTheSkillTreeReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...ready }) };

const memberWaitingForTheBook: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...locked }, { ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...locked }) };

const memberWithTheBookReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...ready }, { ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...locked }) };

const memberWithTheBookOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...locked }) };

const memberWithEveryFeatureReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...ready }, { ...skillTreeFeature, ...ready }) };

const memberWithEveryFeatureOpen: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...opened }), skillPoints: 2 };

const memberWithOneSkillPoint: MemberProfile = { ...memberWithEveryFeatureOpen, skillPoints: 1 };

const memberWithNoSkillPointsLeft: MemberProfile = { ...memberWithEveryFeatureOpen, skillPoints: 0 };

const memberAtLevel7WithOneSkillPoint: MemberProfile = { ...memberWithOneSkillPoint, progression: { level: 7, xp: 1600, levelStartsAt: 1500, nextLevelAt: 2100, xpToNextLevel: 500 } };

const memberWithCoinsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...coinsFeature, ...ready }) };

const memberWithCoinsOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...coinsFeature, ...opened }) };

const memberWithTheInventory: MemberProfile = {
  ...memberWithCoinsOpened,
  progression: { level: 6, xp: 1010, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 490 },
  coins: 236,
  inventory: inventoryFixtures.threeOwned,
};

const memberWithCustomEmoji: MemberProfile = { ...memberWithTheInventory, inventory: inventoryFixtures.withCustomEmoji };

const memberWithNothingForSale: MemberProfile = { ...memberWithTheInventory, inventory: inventoryFixtures.nothingForSale };

const memberWithOneEmojiForSale: MemberProfile = { ...memberWithTheInventory, inventory: inventoryFixtures.oneForSale };

const memberShortOfCoins: MemberProfile = { ...memberWithTheInventory, coins: 40 };

const memberWithTheCrateStore: MemberProfile = { ...memberWithTheInventory, ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...coinsFeature, ...opened }), coins: 120 };

const memberWithTheBookSpread: MemberProfile = { ...memberWithTheCrateStore, avatar: null, bookSpread: true };

const memberWithTheAlbum: MemberProfile = { ...memberWithTheCrateStore, avatar: null, album: true };

const memberWithCoinsBeforeTheStore: MemberProfile = { ...memberWithCoinsOpened, coins: 40 };

const memberAcrossTheSheet: MemberProfile = {
  ...member,
  ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...ready }, { ...questsFeature, ...opened }, { ...skillTreeFeature, ...locked }),
  skillPoints: 0,
};

const memberWithEveryPanelLocked: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...locked }, { ...leaderboardFeature, ...locked }, { ...questsFeature, ...locked }, { ...skillTreeFeature, ...locked }) };

const memberWithEveryPanelReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...ready }, { ...leaderboardFeature, ...ready }, { ...questsFeature, ...ready }, { ...skillTreeFeature, ...ready }) };

const memberWithEveryPanelOpen: MemberProfile = { ...member, ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...questsFeature, ...opened }, { ...skillTreeFeature, ...opened }), skillPoints: 2 };

const memberWithNothingShipped: MemberProfile = { ...member, ...onTheUnlockPath() };

const memberWithEveryNavState: MemberProfile = {
  ...member,
  ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...ready }, { ...questsFeature, ...locked }, { ...skillTreeFeature, ...locked }),
  progression: { level: 2, xp: 50, levelStartsAt: 20, nextLevelAt: 100, xpToNextLevel: 50 },
};

const memberAtLevel1WithTheBookReady: MemberProfile = {
  ...member,
  ...onTheUnlockPath({ ...bookFeature, ...ready }, { ...leaderboardFeature, ...locked }, { ...questsFeature, ...locked }, { ...skillTreeFeature, ...locked }),
  progression: { level: 1, xp: 10, levelStartsAt: 0, nextLevelAt: 20, xpToNextLevel: 10 },
};

const memberAtLevel3WithTheQuestsReady: MemberProfile = {
  ...member,
  ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...questsFeature, ...ready }, { ...skillTreeFeature, ...locked }),
  progression: { level: 3, xp: 130, levelStartsAt: 100, nextLevelAt: 300, xpToNextLevel: 170 },
};

const firstThanks = { step: "first-thanks", goal: "Give a kudos that says why.", hint: "It counts when your message has 5 or more words besides mentions and emoji.", reward: { xp: 10 }, feature: null } as const;

const firstQuest = { step: "first-quest", goal: "Finish a weekly quest.", hint: null, reward: { xp: 20 }, feature: "quests" } as const;

const someoneNew = { step: "someone-new", goal: "Thank someone you haven't thanked before.", hint: null, reward: { xp: 30 }, feature: "leaderboard" } as const;

const activeStep = { state: "active", waiting: false, crate: null, seen: null } as const;

const journeyStarted: JourneyStep[] = [{ ...firstThanks, ...activeStep }];

const journeyUnderway: JourneyStep[] = [
  { ...firstThanks, state: "opened", waiting: false, crate: null, seen: "a17f03" },
  { ...firstQuest, state: "finished", waiting: false, crate: { kind: "journey", step: "first-quest" }, seen: "b2c9e4" },
  { ...someoneNew, ...activeStep },
];

const memberStartingTheJourney: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...locked }), journey: journeyStarted };

const memberWithQuestsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...ready }), journey: journeyStarted };

const memberWithQuests: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...opened }), journey: journeyUnderway };

const memberWithQuestsAtLevel3: MemberProfile = { ...memberWithQuests, progression: { level: 3, xp: 130, levelStartsAt: 100, nextLevelAt: 140, xpToNextLevel: 10 } };

const memberWithPacks: MemberProfile = { ...memberWithTheBookSpread, ...onTheUnlockPath({ ...bookFeature, ...opened }, { ...leaderboardFeature, ...opened }, { ...questsFeature, ...opened }, { ...coinsFeature, ...opened }), journey: journeyUnderway, progression: { level: 6, xp: fixtureStanding.xp, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 1500 - fixtureStanding.xp }, coins: fixtureStanding.coins };

const memberCrossingIntoLevel6: MemberProfile = {
  ...member,
  ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...questsFeature, ...opened }, { ...skillTreeFeature, ...opened }),
  journey: journeyUnderway,
  skillPoints: 2,
  progression: { level: 6, xp: 1010, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 490 },
};

const memberWithAQuietWeek: MemberProfile = { ...member, thisWeek: { given: 0, received: 0 } };

const memberAtLevel1: MemberProfile = { ...member, progression: { level: 1, xp: 0, levelStartsAt: 0, nextLevelAt: 20, xpToNextLevel: 20 } };

const memberBeforeTheirFirstKudos: MemberProfile = { ...memberAtLevel1, thisWeek: { given: 0, received: 0 }, lifetime: { given: 0, received: 0 } };

const memberAtLevel7: MemberProfile = { ...member, progression: { level: 7, xp: 1600, levelStartsAt: 1500, nextLevelAt: 2100, xpToNextLevel: 500 } };

export const shellFixtures = {
  loading: { kind: "loading" },
  connecting: { kind: "connecting" },
  closed: { kind: "closed" },
  signedOut: { kind: "signed-out" },
  signInUnfinished: { kind: "sign-in-unfinished" },
  verifying: { kind: "verifying" },
  unverified: { kind: "unverified" },
  notAMember: { kind: "not-a-member" },
  member,
  memberWithAQuietWeek,
  memberWithTheBoard,
  memberWithSettings: { ...memberWithTheBoard, settings: true },
  memberWaitingForTheBoard,
  memberWithTheBoardReady,
  memberWithTheBoardOpened,
  memberWithTheQuestsReady,
  memberWithTheQuestsOpened,
  memberWithTheSkillTreeReady,
  memberWaitingForTheBook,
  memberWithTheBookReady,
  memberWithTheBookOpened,
  memberWithEveryFeatureReady,
  memberWithEveryFeatureOpen,
  memberWithOneSkillPoint,
  memberWithNoSkillPointsLeft,
  memberAtLevel7WithOneSkillPoint,
  memberWithCoinsReady,
  memberWithCoinsOpened,
  memberWithTheInventory,
  memberWithCustomEmoji,
  memberWithNothingForSale,
  memberWithOneEmojiForSale,
  memberShortOfCoins,
  memberWithTheCrateStore,
  memberWithTheBookSpread,
  memberWithTheAlbum,
  memberWithPacks,
  memberWithCoinsBeforeTheStore,
  memberWithNothingShipped,
  memberAtLevel1WithTheBookReady,
  memberWithEveryNavState,
  memberAtLevel3WithTheQuestsReady,
  memberAcrossTheSheet,
  memberWithEveryPanelLocked,
  memberWithEveryPanelReady,
  memberWithEveryPanelOpen,
  memberAtLevel1,
  memberBeforeTheirFirstKudos,
  memberAtLevel7,
  memberStartingTheJourney,
  memberWithQuestsReady,
  memberWithQuests,
  memberWithQuestsAtLevel3,
  memberCrossingIntoLevel6,
  error: { kind: "broken" },
} as const satisfies Record<string, ShellState>;

const fixturesByName: Record<string, ShellState> = {
  loading: shellFixtures.loading,
  connecting: shellFixtures.connecting,
  closed: shellFixtures.closed,
  "signed-out": shellFixtures.signedOut,
  "sign-in-unfinished": shellFixtures.signInUnfinished,
  verifying: shellFixtures.verifying,
  unverified: shellFixtures.unverified,
  "not-a-member": shellFixtures.notAMember,
  member: shellFixtures.member,
  "member-quiet-week": shellFixtures.memberWithAQuietWeek,
  "member-with-the-board": shellFixtures.memberWithTheBoard,
  "member-with-settings": shellFixtures.memberWithSettings,
  "member-waiting-for-the-board": shellFixtures.memberWaitingForTheBoard,
  "member-with-the-board-ready": shellFixtures.memberWithTheBoardReady,
  "member-with-the-board-opened": shellFixtures.memberWithTheBoardOpened,
  "member-with-the-skill-tree-ready": shellFixtures.memberWithTheSkillTreeReady,
  "member-waiting-for-the-book": shellFixtures.memberWaitingForTheBook,
  "member-with-the-book-ready": shellFixtures.memberWithTheBookReady,
  "member-with-the-book-opened": shellFixtures.memberWithTheBookOpened,
  "member-with-every-feature-ready": shellFixtures.memberWithEveryFeatureReady,
  "member-with-every-feature-open": shellFixtures.memberWithEveryFeatureOpen,
  "member-with-one-skill-point": shellFixtures.memberWithOneSkillPoint,
  "member-with-no-skill-points-left": shellFixtures.memberWithNoSkillPointsLeft,
  "member-level-7-with-one-skill-point": shellFixtures.memberAtLevel7WithOneSkillPoint,
  "member-with-nothing-shipped": shellFixtures.memberWithNothingShipped,
  "member-at-level-1-with-the-book-ready": shellFixtures.memberAtLevel1WithTheBookReady,
  "member-with-every-nav-state": shellFixtures.memberWithEveryNavState,
  "member-at-level-3-with-the-quests-ready": shellFixtures.memberAtLevel3WithTheQuestsReady,
  "member-level-1": shellFixtures.memberAtLevel1,
  "member-before-their-first-kudos": shellFixtures.memberBeforeTheirFirstKudos,
  "member-level-7": shellFixtures.memberAtLevel7,
  "member-starting-the-journey": shellFixtures.memberStartingTheJourney,
  "member-with-quests-ready": shellFixtures.memberWithQuestsReady,
  "member-with-quests": shellFixtures.memberWithQuests,
  "member-with-quests-at-level-3": shellFixtures.memberWithQuestsAtLevel3,
  "member-crossing-into-level-6": shellFixtures.memberCrossingIntoLevel6,
  "member-with-the-inventory": shellFixtures.memberWithTheInventory,
  "member-with-custom-emoji": shellFixtures.memberWithCustomEmoji,
  "member-with-nothing-for-sale": shellFixtures.memberWithNothingForSale,
  "member-with-one-emoji-for-sale": shellFixtures.memberWithOneEmojiForSale,
  "member-short-of-coins": shellFixtures.memberShortOfCoins,
  "member-with-the-crate-store": shellFixtures.memberWithTheCrateStore,
  "member-with-the-book-spread": shellFixtures.memberWithTheBookSpread,
  album: shellFixtures.memberWithTheAlbum,
  "album-maintainer": shellFixtures.memberWithTheAlbum,
  "album-without-a-team": shellFixtures.memberWithTheAlbum,
  "album-with-new-emojis": shellFixtures.memberWithTheAlbum,
  "album-as-an-admin": shellFixtures.memberWithTheAlbum,
  "member-with-packs": shellFixtures.memberWithPacks,
  "member-with-more-packs": shellFixtures.memberWithPacks,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {}, openFeature: async () => ({ kind: "opened" }), openQuestCrate: async () => ({ kind: "opened" }), buyPerk: async () => ({ kind: "bought" }), buyItem: async ({ item }) => ({ kind: "bought", item }), buyCrate: async (next) => ({ kind: "bought", crate: `bought:${next}` }), openCrate: async (crate) => fixturePackOpenOf(crate), setBoardVisibility: async (visible) => ({ kind: "set", visible }), setMessageSetting: async (_kind, place) => ({ kind: "set", place }), pickPrimaryGroup: async (group) => ({ kind: "picked", group }), linkMyCompanyProfile: async () => ({ kind: "linked" }), linkCompanyProfile: async () => ({ kind: "linked" }), setWorkspaceSettings: async () => ({ kind: "set" }), mapSlackEmoji: async () => ({ kind: "mapped" }), mapMyEmoji: async () => ({ kind: "mapped" }), setAvatar: async () => ({ kind: "refused" }), swapQuest: async () => ({ kind: "swapped" }), openThoughtfulPack: async (pack) => fixturePackOpeningOf(pack), putIn: async (item) => fixturePutInOf(item), putAllIn: async () => fixturePutAllIn(), unlockTeamSticker: async (team) => fixtureUnlockOf(albumFixtures.midway, team), markEmojisSeen: async (ids) => ({ kind: "seen", ids }) };
