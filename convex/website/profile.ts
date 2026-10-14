import { companyFaceOf } from "../companyProfiles/faces";
import type { QueryCtx } from "../_generated/server";
import { homeFacts } from "../engine/home";
import { workspaceLink } from "../slack/workspaceLink";
import { followTheClock } from "./clock";
import { memberQuery, type Denial, type VerifiedMember } from "./memberQuery";

export type Face =
  | { kind: "company-profile"; image: string; colour: string; initials: string }
  | { kind: "slack"; image: string; initials: string }
  | { kind: "initials"; initials: string };

export type Kudos = { given: number; received: number };

export type MemberProfile = {
  kind: "member";
  name?: string;
  face: Face;
  kudosEmoji: string;
  allowance: { left: number; base: number; refillsAt: number };
  thisWeek: Kudos;
  lifetime: Kudos;
  chatUrl: string;
};

export type MyProfile = Denial | MemberProfile;

export const getMyProfile = memberQuery(async (ctx, me): Promise<MemberProfile | Denial> => {
  await followTheClock(ctx);
  const facts = await homeFacts(ctx, me.workspace, me.user);
  if (facts?.kind !== "member") return { kind: "not-a-member" };
  return {
    kind: "member",
    ...(me.name !== undefined && { name: me.name }),
    face: await faceOf(ctx, me),
    kudosEmoji: facts.kudosEmoji,
    allowance: { left: facts.left, base: facts.base, refillsAt: facts.refillsAt },
    thisWeek: { given: facts.givenWeek, received: facts.receivedWeek },
    lifetime: { given: facts.given, received: facts.received },
    chatUrl: workspaceLink(me.workspace),
  };
});

async function faceOf(ctx: QueryCtx, me: VerifiedMember): Promise<Face> {
  const initials = initialsOf(me);
  const companyFace = await companyFaceOf(ctx, realNameOf(me));
  if (companyFace !== undefined) return { kind: "company-profile", ...companyFace, initials };
  if (me.image !== undefined) return { kind: "slack", image: me.image, initials };
  return { kind: "initials", initials };
}

function realNameOf({ name, givenName, familyName }: VerifiedMember) {
  return name ?? [givenName, familyName].filter((part) => part !== undefined).join(" ");
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
