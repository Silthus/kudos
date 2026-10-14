import { companyFaceOf } from "../companyProfiles/faces";
import type { QueryCtx } from "../_generated/server";
import type { VerifiedMember } from "./memberQuery";

export type Face =
  | { kind: "company-profile"; image: string; colour: string; initials: string }
  | { kind: "slack"; image: string; initials: string }
  | { kind: "initials"; initials: string };

export async function faceOf(ctx: QueryCtx, me: VerifiedMember): Promise<Face> {
  const initials = initialsOf(me);
  const companyFace = await companyFaceOf(ctx, realNameOf(me));
  if (companyFace !== undefined) return { kind: "company-profile", ...companyFace, initials };
  if (me.image !== undefined) return { kind: "slack", image: me.image, initials };
  return { kind: "initials", initials };
}

export function initialsFaceOf(name: string | undefined): Face {
  return { kind: "initials", initials: initialsOf({ name }) };
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
