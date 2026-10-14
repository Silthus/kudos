import type { MemberProfile, MyProfile } from "../../convex/website/profile";

export type { Face, MemberProfile, Progression } from "../../convex/website/profile";
export type { Period } from "../../convex/leaderboard/periods";

export type Visitor = MyProfile | { kind: "loading" } | { kind: "connecting" } | { kind: "sign-in-unfinished" };

export type ShellState = Visitor | { kind: "broken" };

export type ShellActions = { signIn(): void; signOut(): void };

const member: MemberProfile = {
  kind: "member",
  name: "Sam Example",
  face: { kind: "initials", initials: "SE" },
  kudosEmoji: "taco",
  allowance: { left: 1, base: 3, refillsAt: Date.parse("2026-10-14T00:00:00Z") },
  thisWeek: { given: 2, received: 1 },
  lifetime: { given: 14, received: 9 },
  chatUrl: "https://app.slack.com/client/T1",
  leaderboard: "off",
  leaderboardLevel: 3,
  progression: null,
};

const memberWithTheBoard: MemberProfile = { ...member, leaderboard: "open" };

const memberWaitingForTheBoard: MemberProfile = { ...member, leaderboard: "locked" };

const memberWithTheBoardReady: MemberProfile = { ...member, leaderboard: "ready" };

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
  "member-level-1": shellFixtures.memberAtLevel1,
  "member-level-7": shellFixtures.memberAtLevel7,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {} };
