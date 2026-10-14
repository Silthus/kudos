import type { Feature } from "../../convex/unlocks/feature";
import type { CommandAnswer } from "../../convex/website/commands";
import type { Denial } from "../../convex/website/memberQuery";
import type { FeatureCard, MemberProfile, MyProfile } from "../../convex/website/profile";

export type { Face, FeatureCard, MemberProfile, PageWaits, Progression } from "../../convex/website/profile";
export type { Leaderboard, LeaderboardRow, MyLeaderboard } from "../../convex/website/leaderboard";
export type { Period } from "../../convex/leaderboard/periods";
export type { CommandAnswer } from "../../convex/website/commands";
export type { Feature } from "../../convex/unlocks/feature";

export type OpenAnswer = CommandAnswer | Denial;

export type Visitor = MyProfile | { kind: "loading" } | { kind: "connecting" } | { kind: "sign-in-unfinished" };

export type ShellState = Visitor | { kind: "broken" };

export type ShellActions = { signIn(): void; signOut(): void; openFeature(feature: Feature): Promise<OpenAnswer> };

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
  progression: null,
};

const readyAt = Date.parse("2026-10-12T09:00:00Z");

const openedAt = Date.parse("2026-10-13T09:00:00Z");

const leaderboardFeature = { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 3, seen: "5e3a0c" } as const;

const questsFeature = { feature: "quests", name: "Quests", opens: "your weekly quests", level: 2, seen: "7d20e4" } as const;

const bookFeature = { feature: "book", name: "Book", opens: "your achievements", level: 4, seen: "c4f8a1" } as const;

const skillTreeFeature = { feature: "skillTree", name: "Skill tree", opens: "the tree and your first skill point", level: 5, seen: "9b71d2" } as const;

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

const memberWithEveryFeatureOpen: MemberProfile = { ...member, ...onTheUnlockPath({ ...leaderboardFeature, ...opened }, { ...bookFeature, ...opened }, { ...skillTreeFeature, ...opened }) };

const memberWithNothingShipped: MemberProfile = { ...member, ...onTheUnlockPath() };

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
  memberWithNothingShipped,
  memberAtLevel1,
  memberAtLevel7,
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
  "member-with-nothing-shipped": shellFixtures.memberWithNothingShipped,
  "member-level-1": shellFixtures.memberAtLevel1,
  "member-level-7": shellFixtures.memberAtLevel7,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {}, openFeature: async () => ({ kind: "opened" }) };
