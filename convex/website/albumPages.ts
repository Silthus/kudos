import type { QueryCtx } from "../_generated/server";
import type { Message } from "../activity/entries";
import { kudosWordsOf, mentionsOfOnePage, permalinkOfMessage, type Mentions } from "../activity/kudos";
import { personPageOf, type HypeEmoji, type PersonTeam } from "../album/personPage";
import { lastKindNoteTo, newestStickersOf, type KindNote } from "../album/profile";
import type { HoggieFound } from "../album/records";
import { weekEditionOf, type Issue, type WeekTab } from "../album/weekIssue";
import type { WeekKudos, WeekKudosList } from "../album/weekKudos";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { givenFactsOf } from "../engine/awards";
import type { DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { companyTeammateOf, type Face } from "./faces";
import type { VerifiedMember } from "./memberQuery";

export type AlbumPersonFace = { person: MemberId; name: string; face: Face };

const mentionLookupsAnIssue = 1_000;

export type AlbumKudos = { message: Message; permalink: string | null; at: number };

export type AlbumPersonAnswer = AlbumPersonFace & {
  kind: "person";
  held: boolean;
  firstThankedAt: number | null;
  kudosGiven: number;
  kudosReceived: number;
  hugsGiven: number;
  hugsReceived: number;
  best: AlbumKudos | null;
  teams: PersonTeam[];
  hype: HypeEmoji;
};

export type PeopleShown = { people: AlbumPersonFace[]; more: number };

export type AlbumWeekKudos = AlbumKudos & { people: AlbumPersonFace[]; morePeople: number };

export type AlbumWeekKudosList = { kudos: AlbumWeekKudos[]; more: boolean };

export type AlbumIssue = Omit<Issue, "kudosOfWeek" | "thanked" | "thankedBy" | "hugged" | "huggedBy" | "newFaces" | "hoggiesFound" | "given" | "received"> & {
  kudosOfWeek: (AlbumKudos & { giver: AlbumPersonFace; hugs: number }) | null;
  thanked: PeopleShown;
  thankedBy: PeopleShown;
  hugged: PeopleShown;
  huggedBy: PeopleShown;
  newFaces: PeopleShown;
  hoggies: { hoggies: HoggieFound[]; more: number };
  given: AlbumWeekKudosList;
  received: AlbumWeekKudosList;
};

export type AlbumWeekAnswer = { kind: "week"; week: DayKey; weeks: WeekTab[]; issue: AlbumIssue | null };

export type AlbumKindNote = AlbumKudos & { giver: AlbumPersonFace };

export type AlbumProfileAnswer = { kind: "profile"; note: AlbumKindNote | null; newest: (AlbumPersonFace & { at: number })[] };

export async function albumPersonOf(ctx: QueryCtx, me: VerifiedMember, person: MemberId): Promise<AlbumPersonAnswer | { kind: "no-person" }> {
  const page = await personPageOf(ctx, me, person);
  if (page === null) return { kind: "no-person" };
  const { best, ...history } = page;
  const mentions = mentionsOfOnePage(ctx);
  return { kind: "person", ...(await faceIn(ctx, me.workspace, person)), ...history, best: best === null ? null : await kudosShown(ctx, mentions, best.message, best.at) };
}

export async function albumWeekOf(ctx: QueryCtx, me: VerifiedMember, asked: DayKey | undefined): Promise<AlbumWeekAnswer> {
  const { week, weeks, issue } = await weekEditionOf(ctx, me.member, asked, Date.now());
  return { kind: "week", week, weeks, issue: issue === null ? null : await issueShown(ctx, me.workspace, issue) };
}

export async function albumProfileOf(ctx: QueryCtx, me: VerifiedMember, peopleSearched: number): Promise<AlbumProfileAnswer> {
  const note = await lastKindNoteTo(ctx, me.member);
  const newest = await newestStickersOf(ctx, me.member, peopleSearched);
  return {
    kind: "profile",
    note: note === null ? null : await kindNoteShown(ctx, me.workspace, note),
    newest: await Promise.all(newest.map(async ({ person, at }) => ({ ...(await faceIn(ctx, me.workspace, person)), at }))),
  };
}

async function kindNoteShown(ctx: QueryCtx, workspace: string, { giver, message, at }: KindNote): Promise<AlbumKindNote> {
  return { giver: await faceIn(ctx, workspace, giver), ...(await kudosShown(ctx, mentionsOfOnePage(ctx), message, at)) };
}

async function issueShown(ctx: QueryCtx, workspace: string, { kudosOfWeek, thanked, thankedBy, hugged, huggedBy, newFaces, hoggiesFound, given, received, ...counts }: Issue): Promise<AlbumIssue> {
  const people = async ({ people: listed, more }: { people: MemberId[]; more: number }): Promise<PeopleShown> => ({ people: await Promise.all(listed.map((person) => faceIn(ctx, workspace, person))), more });
  const mentions = mentionsOfOnePage(ctx, mentionLookupsAnIssue);
  const kudosList = async ({ kudos, more }: WeekKudosList): Promise<AlbumWeekKudosList> => ({ kudos: await Promise.all(kudos.map((each) => weekKudosShown(ctx, workspace, mentions, each))), more });
  return {
    ...counts,
    kudosOfWeek: kudosOfWeek === null ? null : await kudosOfTheWeekShown(ctx, workspace, mentions, kudosOfWeek),
    thanked: await people(thanked),
    thankedBy: await people(thankedBy),
    hugged: await people(hugged),
    huggedBy: await people(huggedBy),
    newFaces: await people(newFaces),
    hoggies: hoggiesFound,
    given: await kudosList(given),
    received: await kudosList(received),
  };
}

async function kudosOfTheWeekShown(ctx: QueryCtx, workspace: string, mentions: Mentions, { message, hugs, at }: NonNullable<Issue["kudosOfWeek"]>): Promise<AlbumIssue["kudosOfWeek"]> {
  const given = await givenFactsOf(ctx, message);
  if (given === null) return null;
  return { giver: await faceIn(ctx, workspace, given.giver), ...(await kudosShown(ctx, mentions, message, at)), hugs };
}

async function weekKudosShown(ctx: QueryCtx, workspace: string, mentions: Mentions, { message, at, people, morePeople }: WeekKudos): Promise<AlbumWeekKudos> {
  return { ...(await kudosShown(ctx, mentions, message, at)), people: await Promise.all(people.map((person) => faceIn(ctx, workspace, person))), morePeople };
}

async function kudosShown(ctx: QueryCtx, mentions: Mentions, message: MessageRef, at: number): Promise<AlbumKudos> {
  return { message: await kudosWordsOf(ctx, mentions, message), permalink: await permalinkOfMessage(ctx, message), at };
}

async function faceIn(ctx: QueryCtx, workspace: string, person: MemberId): Promise<AlbumPersonFace> {
  const { name, picture } = await nameAndPictureOf(ctx, person);
  return { person, ...companyTeammateOf(name, picture, (await storedCompanyFaceOf(ctx, workspace, person)) ?? null) };
}
