import type { Feature } from "../../convex/unlocks/feature";
import type { Quest } from "../../convex/quests/step";
import type { PerkId } from "../../convex/progression/tree";
import type { CommandAnswer, PurchaseAnswer } from "../../convex/website/commands";
import type { Denial } from "../../convex/website/memberQuery";
import type { FeatureCard, JourneyStep, MemberProfile, MyProfile } from "../../convex/website/profile";
import type { QuestsAnswer } from "../../convex/website/quests";
import type { BookAnswer } from "../../convex/website/book";
import type { MySkillTree } from "../../convex/website/skillTree";

export type { Face, FeatureCard, JourneyStep, MemberProfile, PageWaits, Progression } from "../../convex/website/profile";
export type { QuestsAnswer, QuestSlot, WaitingCrate } from "../../convex/website/quests";
export type { BookAnswer, LadderCard, TierCard } from "../../convex/website/book";
export type { TierId } from "../../convex/achievements/ladders";
export type { MySkillTree, PerkNode, SkillTreeAnswer, TreeRow } from "../../convex/website/skillTree";
export type { Leaderboard, LeaderboardRow, MyLeaderboard } from "../../convex/website/leaderboard";
export type { Period } from "../../convex/leaderboard/periods";
export type { CommandAnswer, PurchaseAnswer, PurchaseRefusal } from "../../convex/website/commands";
export type { Feature } from "../../convex/unlocks/feature";
export type { Quest } from "../../convex/quests/step";

export type OpenAnswer = CommandAnswer | Denial;

export type Purchase = { perk: PerkId; request: string };

export type BuyAnswer = PurchaseAnswer | Denial;

export type MyQuests = QuestsAnswer | Denial;

export type MyBook = BookAnswer | Denial;

export type Visitor = MyProfile | { kind: "loading" } | { kind: "connecting" } | { kind: "sign-in-unfinished" };

export type ShellState = Visitor | { kind: "broken" };

export type ShellActions = { signIn(returnTo: string): void; signOut(): void; openFeature(feature: Feature): Promise<OpenAnswer>; openQuestCrate(quest: Quest): Promise<OpenAnswer>; buyPerk(purchase: Purchase): Promise<BuyAnswer> };

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
};

const readyAt = Date.parse("2026-10-12T09:00:00Z");

const openedAt = Date.parse("2026-10-13T09:00:00Z");

const leaderboardFeature = { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 3, seen: "5e3a0c" } as const;

const bookFeature = { feature: "book", name: "Book", opens: "your achievements", level: 4, seen: "c4f8a1" } as const;

const skillTreeFeature = { feature: "skillTree", name: "Skill tree", opens: "the tree and your first skill point", level: 5, seen: "9b71d2" } as const;

const questsFeature = { feature: "quests", name: "Quests", opens: "your weekly quests", level: 2, seen: "4c8e1f" } as const;

const coinsFeature = { feature: "coins", name: "Coins and inventory", opens: "the wallet, the store's kudos emoji and your emoji slots", level: 6, seen: "e5a6b7" } as const;

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

const memberWithTheQuestsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...ready }, { ...leaderboardFeature, ...locked }) };

const memberWithTheQuestsOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...opened }, { ...leaderboardFeature, ...opened }) };

const memberWithTheSkillTreeReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...skillTreeFeature, ...ready }) };

const memberWaitingForTheBook: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...bookFeature, ...locked }, { ...skillTreeFeature, ...locked }) };

const memberWithTheBookReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...bookFeature, ...ready }, { ...skillTreeFeature, ...locked }) };

const memberWithTheBookOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...bookFeature, ...opened }, { ...skillTreeFeature, ...locked }) };

const memberWithEveryFeatureReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...ready }, { ...skillTreeFeature, ...ready }) };

const memberWithEveryFeatureOpen: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...bookFeature, ...opened }, { ...skillTreeFeature, ...opened }), skillPoints: 2 };

const memberWithOneSkillPoint: MemberProfile = { ...memberWithEveryFeatureOpen, skillPoints: 1 };

const memberWithNoSkillPointsLeft: MemberProfile = { ...memberWithEveryFeatureOpen, skillPoints: 0 };

const memberWithCoinsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...coinsFeature, ...ready }) };

const memberWithCoinsOpened: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...coinsFeature, ...opened }) };

const memberWithNothingShipped: MemberProfile = { ...member, ...onTheUnlockPath() };

const firstThanks = { step: "first-thanks", goal: "Give a kudos that says why.", hint: "It counts when your message has 5 or more words besides mentions and emoji.", reward: { xp: 10 } } as const;

const firstQuest = { step: "first-quest", goal: "Finish a weekly quest.", hint: null, reward: { xp: 20 } } as const;

const someoneNew = { step: "someone-new", goal: "Thank someone you haven't thanked before.", hint: null, reward: { xp: 30 } } as const;

const activeStep = { state: "active", crate: null, seen: null } as const;

const journeyStarted: JourneyStep[] = [{ ...firstThanks, ...activeStep }];

const journeyUnderway: JourneyStep[] = [
  { ...firstThanks, state: "opened", crate: null, seen: "a17f03" },
  { ...firstQuest, state: "finished", crate: { kind: "journey", step: "first-quest" }, seen: "b2c9e4" },
  { ...someoneNew, ...activeStep },
];

const memberStartingTheJourney: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...locked }), journey: journeyStarted };

const memberWithQuestsReady: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...ready }), journey: journeyStarted };

const memberWithQuests: MemberProfile = { ...member, ...onTheUnlockPath({ ...questsFeature, ...opened }), journey: journeyUnderway };

const memberWithAQuietWeek: MemberProfile = { ...member, thisWeek: { given: 0, received: 0 } };

const memberAtLevel1: MemberProfile = { ...member, progression: { level: 1, xp: 0, levelStartsAt: 0, nextLevelAt: 20, xpToNextLevel: 20 } };

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
  memberWithCoinsReady,
  memberWithCoinsOpened,
  memberWithNothingShipped,
  memberAtLevel1,
  memberAtLevel7,
  memberStartingTheJourney,
  memberWithQuestsReady,
  memberWithQuests,
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
  "member-with-nothing-shipped": shellFixtures.memberWithNothingShipped,
  "member-level-1": shellFixtures.memberAtLevel1,
  "member-level-7": shellFixtures.memberAtLevel7,
  "member-starting-the-journey": shellFixtures.memberStartingTheJourney,
  "member-with-quests-ready": shellFixtures.memberWithQuestsReady,
  "member-with-quests": shellFixtures.memberWithQuests,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {}, openFeature: async () => ({ kind: "opened" }), openQuestCrate: async () => ({ kind: "opened" }), buyPerk: async () => ({ kind: "bought" }) };
