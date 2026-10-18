import { albumShownTo } from "../album/flag";
import { waitingPacksOf, type WaitingPack } from "../album/packs";
import { albumStickersOf } from "../album/stickers";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { QueryCtx } from "../_generated/server";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { companyTeammateOf, nameless, storedFaceOf, type Face } from "./faces";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type AlbumAnswer = {
  kind: "album";
  me: { name: string; face: Face; person: MemberId };
  level: { level: number; xp: number; startsAt: number; nextAt: number };
  people: AlbumPerson[];
  morePeople: boolean;
  packs: WaitingPack[];
  morePacks: boolean;
};

export const mostPeopleShown = 500;

export type AlbumPerson = { person: MemberId; name: string; face: Face; held: boolean };

export type AlbumRead = { kind: "off" } | AlbumAnswer;

export const getAlbum = memberQuery(async (ctx, me): Promise<AlbumRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  const { packs, more } = await waitingPacksOf(ctx, me.member);
  const { people, morePeople } = await peopleHeldBy(ctx, me);
  return { kind: "album", me: await meIn(ctx, me), level: await levelOf(ctx, me.member), people, morePeople, packs, morePacks: more };
});

async function meIn(ctx: QueryCtx, me: VerifiedMember): Promise<AlbumAnswer["me"]> {
  return { name: me.name ?? nameless, face: await storedFaceOf(ctx, me), person: me.member };
}

async function levelOf(ctx: QueryCtx, member: MemberId): Promise<AlbumAnswer["level"]> {
  const { level, xp } = await progressionHomeOf(ctx, member);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}

async function peopleHeldBy(ctx: QueryCtx, me: VerifiedMember): Promise<{ people: AlbumPerson[]; morePeople: boolean }> {
  const { stickers, more } = await albumStickersOf(ctx, me.member, mostPeopleShown);
  const people: AlbumPerson[] = [];
  for (const { person } of stickers) {
    const { name, picture } = await nameAndPictureOf(ctx, person);
    people.push({ person, ...companyTeammateOf(name, picture, (await storedCompanyFaceOf(ctx, me.workspace, person)) ?? null), held: true });
  }
  return { people, morePeople: more };
}
