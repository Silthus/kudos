import type { MemberProfile, MyProfile } from "../../convex/website/profile";

export type { Face, MemberProfile } from "../../convex/website/profile";

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
};

const memberWithAQuietWeek: MemberProfile = { ...member, thisWeek: { given: 0, received: 0 } };

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
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellState {
  return fixturesByName[name ?? ""] ?? shellFixtures.closed;
}

export const fixtureActions: ShellActions = { signIn() {}, signOut() {} };
