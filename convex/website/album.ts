import { v } from "convex/values";
import { thoughtfulBoardsOf, type BoardPerson, type BoardTeam, type Standing } from "../album/boards";
import { albumShownTo } from "../album/flag";
import { albumHoggiesOf, type AlbumHoggies } from "../album/hoggies";
import { openThoughtfulPack as openPack, trayOf, type Opening, type TrayItem } from "../album/opening";
import { waitingPacksOf, type WaitingPack } from "../album/packs";
import { putEveryItemIn, putItemIn, type PutIn } from "../album/putIn";
import type { TeamSticker } from "../album/records";
import { albumStickersOf } from "../album/stickers";
import { teamPagesAndPeopleOf, type TeamPage, type TeamPagesAndPeople } from "../album/teamPages";
import { unlockTeamStickerOf } from "../album/teamStickers";
import { currentProfiles, publicNameOf } from "../companyProfiles/matcher";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { hoggiesShownTo } from "../hoggies/flag";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { QueryCtx } from "../_generated/server";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { albumPersonOf, albumWeekOf, type AlbumPersonAnswer, type AlbumWeekAnswer } from "./albumPages";
import { followTheClock } from "./clock";
import { appliedShownTo } from "./commands";
import { companyTeammateOf, nameless, storedFaceOf, teammateOf, type Face } from "./faces";
import { noLaunchWaitsFor } from "./flag";
import { memberMutation } from "./memberMutation";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type AlbumAnswer = {
  kind: "album";
  me: { name: string; face: Face; person: MemberId };
  level: { level: number; xp: number; startsAt: number; nextAt: number };
  teams: AlbumTeam[];
  people: AlbumPerson[];
  morePeople: boolean;
  packs: WaitingPack[];
  morePacks: boolean;
  tray: TrayItem[];
  moreTray: boolean;
};

export const mostPeopleShown = 500;

export type AlbumTeam = Omit<TeamPage, "unmatched"> & { unmatched: string[] };

export type AlbumPerson = { person: MemberId; name: string; face: Face; held: boolean };

export type AlbumRead = { kind: "off" } | AlbumAnswer;

export type OpenAnswer = ({ kind: "opened" } & Opening) | { kind: "refused" };

export type UnlockAnswer = { kind: "unlocked"; sticker: TeamSticker } | { kind: "refused" };

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

export type AlbumPersonRead = { kind: "off" } | { kind: "no-person" } | AlbumPersonAnswer;

export type AlbumWeekRead = { kind: "off" } | AlbumWeekAnswer;

export type AlbumHoggiesAnswer = { kind: "hoggies" } & AlbumHoggies;

export type AlbumHoggiesRead = { kind: "off" } | AlbumHoggiesAnswer;

export const getAlbum = memberQuery(async (ctx, me): Promise<AlbumRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  const { packs, more: morePacks } = await packsToOpenOf(ctx, me);
  const { people: held, morePeople } = await peopleHeldBy(ctx, me);
  const { tray, more: moreTray } = await trayOf(ctx, me.member);
  const { teams, notYetHeld } = await teamsOf(ctx, me);
  return { kind: "album", me: await meIn(ctx, me), level: await levelOf(ctx, me.member), teams, people: [...held, ...notYetHeld], morePeople, packs, morePacks, tray, moreTray };
});

async function teamsOf(ctx: QueryCtx, me: VerifiedMember): Promise<{ teams: AlbumTeam[]; notYetHeld: AlbumPerson[] }> {
  const pagesAndPeople = await teamPagesAndPeopleOf(ctx, me);
  const named = new Map((await currentProfiles(ctx)).map((profile) => [profile.profile, publicNameOf(profile)]));
  const teams = pagesAndPeople.pages.map(({ unmatched, ...page }) => ({ ...page, unmatched: unmatched.flatMap((profile) => named.get(profile) ?? []) }));
  return { teams, notYetHeld: notYetHeldOn(pagesAndPeople, named) };
}

function notYetHeldOn({ pages, held, profileOf }: TeamPagesAndPeople, named: Map<number, string>): AlbumPerson[] {
  const onAPage = new Set(pages.flatMap(({ people }) => people));
  const nameOf = (person: MemberId) => {
    const profile = profileOf.get(person);
    return profile === undefined ? undefined : named.get(profile);
  };
  return [...onAPage].filter((person) => !held.has(person)).map((person) => ({ person, ...teammateOf(nameOf(person), null), held: false }));
}

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

export const unlockTeamSticker = memberMutation({
  args: { team: v.string() },
  handler: async (ctx, me, _person, { team }): Promise<UnlockAnswer> => {
    const sticker = (await albumShownTo(ctx, me.member)) ? await unlockTeamStickerOf(ctx, me, team, Date.now()) : null;
    return sticker === null ? { kind: "refused" } : { kind: "unlocked", sticker };
  },
});

export const getAlbumHoggies = memberQuery(async (ctx, me): Promise<AlbumHoggiesRead> => ((await albumHoggiesShownTo(ctx, me.member)) ? { kind: "hoggies", ...(await albumHoggiesOf(ctx, me.member)) } : { kind: "off" }));

async function albumHoggiesShownTo(ctx: QueryCtx, member: MemberId) {
  return (await albumShownTo(ctx, member)) && (await hoggiesShownTo(ctx, member));
}

export const getThoughtfulBoards = memberQuery({
  args: { team: v.optional(v.string()) },
  handler: async (ctx, me, { team }): Promise<ThoughtfulBoardsRead> => {
    if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
    await followTheClock(ctx);
    const { people, teams, pinned, onTheBoards } = await thoughtfulBoardsOf(ctx, me, team ?? null);
    return { kind: "boards", people: people.map(personRowOf), teams, pinned: { me: pinned.me === null ? null : personRowOf(pinned.me), teams: pinned.teams }, onTheBoards };
  },
});

export const getAlbumPerson = memberQuery({
  args: { person: v.string() },
  handler: async (ctx, me, { person }): Promise<AlbumPersonRead> => {
    if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
    const member = ctx.db.normalizeId("members", person);
    return member === null ? { kind: "no-person" } : albumPersonOf(ctx, me, member);
  },
});

export const getAlbumWeek = memberQuery({
  args: { week: v.optional(v.string()) },
  handler: async (ctx, me, { week }): Promise<AlbumWeekRead> => {
    if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
    await followTheClock(ctx);
    return albumWeekOf(ctx, me, week);
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
