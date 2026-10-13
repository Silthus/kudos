import { memberQuery, type Denial, type VerifiedMember } from "./memberQuery";

export type Face = { kind: "slack"; image: string } | { kind: "initials"; initials: string };

export type MemberProfile = { kind: "member"; name?: string; face: Face };

export type MyProfile = Denial | MemberProfile;

export const getMyProfile = memberQuery(async (_ctx, me): Promise<MemberProfile> => ({
  kind: "member",
  ...(me.name !== undefined && { name: me.name }),
  face: faceOf(me),
}));

function faceOf(me: VerifiedMember): Face {
  if (me.image !== undefined) return { kind: "slack", image: me.image };
  return { kind: "initials", initials: initialsOf(me) };
}

function initialsOf({ name, givenName, familyName }: VerifiedMember) {
  const words = givenName !== undefined && familyName !== undefined ? [givenName, familyName] : (name ?? "").split(/\s+/);
  const initials = words
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials === "" ? "?" : initials;
}
