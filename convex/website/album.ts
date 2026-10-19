import { v } from "convex/values";
import { thoughtfulBoardsOf, type BoardPerson, type BoardTeam, type Standing } from "../album/boards";
import { albumShownTo } from "../album/flag";
import { albumHoggiesOf, type AlbumHoggies } from "../album/hoggies";
import { openThoughtfulPack as openPack, trayOf, type Opening, type TrayItem } from "../album/opening";
import { waitingPacksOf, type WaitingPack } from "../album/packs";
import { putEveryItemIn, putItemIn, type PutIn } from "../album/putIn";
import { albumStickersOf } from "../album/stickers";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { QueryCtx } from "../_generated/server";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { followTheClock } from "./clock";
import { appliedShownTo } from "./commands";
import { companyTeammateOf, nameless, storedFaceOf, type Face } from "./faces";
import { noLaunchWaitsFor } from "./flag";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type AlbumAnswer = {
  kind: "album";
  me: { name: string; face: Face; person: MemberId };
  level: { level: number; xp: number; startsAt: number; nextAt: number };
  people: AlbumPerson[];
  morePeople: boolean;
  packs: WaitingPack[];
  morePacks: boolean;
  tray: TrayItem[];
  moreTray: boolean;
};

export const mostPeopleShown = 500;

export type AlbumPerson = { person: MemberId; name: string; face: Face; held: boolean };

export type AlbumRead = { kind: "off" } | AlbumAnswer;

export type OpenAnswer = ({ kind: "opened" } & Opening) | { kind: "refused" };

export type PutInAnswer = { kind: "placed"; item: TrayItem } | { kind: "refused" };

export type PutAllInAnswer = ({ kind: "placed" } & PutIn) | { kind: "refused" };

export type BoardPersonRow = { person: MemberId; name: string; face: Face; teams: string[]; thoughtful: number; you: boolean } & Standing;

export type BoardTeamRow = BoardTeam & Standing;

export type ThoughtfulBoardsAnswer = {
  kind: "boards";
  people: BoardPersonRow[];
  teams: BoardTeamRow[];
  pinned: { me: BoardPersonRow | null; teams: BoardTeamRow[] };
  onTheBoards: boolean;
};

export type ThoughtfulBoardsRead = { kind: "off" } | ThoughtfulBoardsAnswer;

export type AlbumHoggiesAnswer = { kind: "hoggies" } & AlbumHoggies;

export type AlbumHoggiesRead = { kind: "off" } | AlbumHoggiesAnswer;

export const getAlbum = memberQuery(async (ctx, me): Promise<AlbumRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  const { packs, more: morePacks } = await packsToOpenOf(ctx, me);
  const { people, morePeople } = await peopleHeldBy(ctx, me);
  const { tray, more: moreTray } = await trayOf(ctx, me.member);
  return { kind: "album", me: await meIn(ctx, me), level: await levelOf(ctx, me.member), people, morePeople, packs, morePacks, tray, moreTray };
});

async function packsToOpenOf(ctx: QueryCtx, me: VerifiedMember) {
  return (await noLaunchWaitsFor(ctx, me)) ? waitingPacksOf(ctx, me.member) : { packs: [], more: false };
}

export const openThoughtfulPack = memberMutation({
  args: { pack: v.id("thoughtfulPacks") },
  handler: async (ctx, me, _person, { pack }): Promise<OpenAnswer> => {
    const opening = (await opensPacks(ctx, me)) ? await openPack(ctx, me.member, pack, Date.now()) : null;
    return opening === null ? { kind: "refused" } : { kind: "opened", items: opening.items, applied: await appliedShownTo(ctx, me, opening.applied) };
  },
});

async function opensPacks(ctx: QueryCtx, me: VerifiedMember) {
  return (await albumShownTo(ctx, me.member)) && (await noLaunchWaitsFor(ctx, me));
}

export const putIn = memberMutation({
  args: { item: v.id("trayItems") },
  handler: async (ctx, me, _person, { item }): Promise<PutInAnswer> => {
    const placed = (await albumShownTo(ctx, me.member)) ? await putItemIn(ctx, me, item, Date.now()) : null;
    return placed === null ? { kind: "refused" } : { kind: "placed", item: placed };
  },
});

export const putAllIn = memberMutation({
  args: {},
  handler: async (ctx, me): Promise<PutAllInAnswer> => ((await albumShownTo(ctx, me.member)) ? { kind: "placed", ...(await putEveryItemIn(ctx, me, Date.now())) } : { kind: "refused" }),
});

export const getAlbumHoggies = memberQuery(async (ctx, me): Promise<AlbumHoggiesRead> => ((await albumShownTo(ctx, me.member)) ? { kind: "hoggies", ...(await albumHoggiesOf(ctx, me.member)) } : { kind: "off" }));

export const getThoughtfulBoards = memberQuery({
  args: { team: v.optional(v.string()) },
  handler: async (ctx, me, { team }): Promise<ThoughtfulBoardsRead> => {
    if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
    await followTheClock(ctx);
    const { people, teams, pinned, onTheBoards } = await thoughtfulBoardsOf(ctx, me, team ?? null);
    return { kind: "boards", people: people.map(personRowOf), teams, pinned: { me: pinned.me === null ? null : personRowOf(pinned.me), teams: pinned.teams }, onTheBoards };
  },
});

function personRowOf({ member, name, picture, face, teams, thoughtful, viewer, ...standing }: BoardPerson & Standing): BoardPersonRow {
  const teammate = companyTeammateOf(name, picture, face);
  return { person: member, name: teammate.name, face: teammate.face, teams, thoughtful, you: viewer, ...standing };
}

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
