import { albumShownTo } from "../album/flag";
import { waitingPacksOf, type WaitingPack } from "../album/packs";
import { companyProfileOf } from "../companyProfiles/matcher";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { faceOf, nameless, type Face } from "./faces";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type AlbumAnswer = {
  kind: "album";
  me: { name: string; face: Face; person: MemberId; team: string | null };
  level: { level: number; xp: number; startsAt: number; nextAt: number };
  packs: WaitingPack[];
  morePacks: boolean;
};

export type AlbumRead = { kind: "off" } | AlbumAnswer;

export const getAlbum = memberQuery(async (ctx, me): Promise<AlbumRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  const { packs, more } = await waitingPacksOf(ctx, me.member);
  return { kind: "album", me: await meIn(ctx, me), level: await levelOf(ctx, me.member), packs, morePacks: more };
});

async function meIn(ctx: QueryCtx, me: VerifiedMember): Promise<AlbumAnswer["me"]> {
  const match = await companyProfileOf(ctx, me.member);
  return { name: me.name ?? nameless, face: await faceOf(ctx, me), person: me.member, team: match?.profile?.teams[0] ?? null };
}

async function levelOf(ctx: QueryCtx, member: MemberId): Promise<AlbumAnswer["level"]> {
  const { level, xp } = await progressionHomeOf(ctx, member);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}
