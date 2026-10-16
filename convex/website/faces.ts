import { companyFaceOf, type CompanyFace } from "../companyProfiles/faces";
import { teamPagesShownTo } from "../companyProfiles/flag";
import { companyProfileOf } from "../companyProfiles/matcher";
import type { QueryCtx } from "../_generated/server";
import type { VerifiedMember } from "./memberQuery";

export type Face =
  | { kind: "company-profile"; image: string; colour: string; initials: string }
  | { kind: "slack"; image: string; initials: string }
  | { kind: "initials"; initials: string };

export async function faceOf(ctx: QueryCtx, me: VerifiedMember): Promise<Face> {
  const initials = initialsOf(me);
  const companyFace = await ownCompanyFaceOf(ctx, me);
  if (companyFace !== undefined) return { kind: "company-profile", ...companyFace, initials };
  if (me.image !== undefined) return { kind: "slack", image: me.image, initials };
  return { kind: "initials", initials };
}

async function ownCompanyFaceOf(ctx: QueryCtx, me: VerifiedMember): Promise<CompanyFace | undefined> {
  if (!(await teamPagesShownTo(ctx, me.member))) return companyFaceOf(ctx, realNameOf(me));
  const profile = (await companyProfileOf(ctx, me.member))?.profile;
  return profile?.image === undefined ? undefined : { image: profile.image, colour: profile.colour };
}

export const nameless = "A teammate";

export function teammateOf(name: string | undefined, picture: string | null) {
  return { name: name ?? nameless, face: teammateFaceOf(name, picture) };
}

function teammateFaceOf(name: string | undefined, picture: string | null): Face {
  const initials = initialsOf({ name });
  if (picture !== null) return { kind: "slack", image: picture, initials };
  return { kind: "initials", initials };
}

type Names = { name?: string; givenName?: string; familyName?: string };

function realNameOf({ name, givenName, familyName }: Names) {
  return name ?? [givenName, familyName].filter((part) => part !== undefined).join(" ");
}

function initialsOf({ name, givenName, familyName }: Names) {
  const words = givenName !== undefined && familyName !== undefined ? [givenName, familyName] : (name ?? "").split(/\s+/);
  const initials = words
    .map(firstLetterOf)
    .filter((letter) => letter !== undefined)
    .slice(0, 2)
    .join("");
  return initials === "" ? "?" : initials;
}

function firstLetterOf(word: string) {
  return word.match(/\p{L}/u)?.[0]?.toUpperCase();
}
