export type Face = { kind: "slack"; image: string } | { kind: "initials"; initials: string };

export type SignedInMember = { name: string; face: Face };

export type Visitor = { kind: "closed" } | { kind: "signed-out" } | { kind: "member"; member: SignedInMember };

export type ShellFixture = Visitor | { kind: "broken" };

const member: SignedInMember = { name: "Sam Example", face: { kind: "initials", initials: "SE" } };

export const shellFixtures = {
  closed: { kind: "closed" },
  signedOut: { kind: "signed-out" },
  member: { kind: "member", member },
  error: { kind: "broken" },
} as const satisfies Record<string, ShellFixture>;

const fixtureNames: Record<string, ShellFixture> = {
  closed: shellFixtures.closed,
  "signed-out": shellFixtures.signedOut,
  member: shellFixtures.member,
  error: shellFixtures.error,
};

export function builtShell(name: string | undefined): ShellFixture {
  return fixtureNames[name ?? ""] ?? shellFixtures.closed;
}
