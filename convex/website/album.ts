import { v } from "convex/values";
import { albumShownTo } from "../album/flag";
import { openThoughtfulPack as openPack, trayOf, type Opening, type TrayItem } from "../album/opening";
import { waitingPacksOf, type WaitingPack } from "../album/packs";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { nameless, storedFaceOf, type Face } from "./faces";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type AlbumAnswer = {
  kind: "album";
  me: { name: string; face: Face; person: MemberId };
  level: { level: number; xp: number; startsAt: number; nextAt: number };
  packs: WaitingPack[];
  morePacks: boolean;
  tray: TrayItem[];
  moreTray: boolean;
};

export type AlbumRead = { kind: "off" } | AlbumAnswer;

export type OpenAnswer = ({ kind: "opened" } & Opening) | { kind: "refused" };

export const getAlbum = memberQuery(async (ctx, me): Promise<AlbumRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  const { packs, more: morePacks } = await waitingPacksOf(ctx, me.member);
  const { tray, more: moreTray } = await trayOf(ctx, me.member);
  return { kind: "album", me: await meIn(ctx, me), level: await levelOf(ctx, me.member), packs, morePacks, tray, moreTray };
});

export const openThoughtfulPack = memberMutation({
  args: { pack: v.id("thoughtfulPacks") },
  handler: async (ctx, me, _person, { pack }): Promise<OpenAnswer> => {
    const opening = (await albumShownTo(ctx, me.member)) ? await openPack(ctx, me.member, pack, Date.now()) : null;
    return opening === null ? { kind: "refused" } : { kind: "opened", ...opening };
  },
});

async function meIn(ctx: QueryCtx, me: VerifiedMember): Promise<AlbumAnswer["me"]> {
  return { name: me.name ?? nameless, face: await storedFaceOf(ctx, me), person: me.member };
}

async function levelOf(ctx: QueryCtx, member: MemberId): Promise<AlbumAnswer["level"]> {
  const { level, xp } = await progressionHomeOf(ctx, member);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}
