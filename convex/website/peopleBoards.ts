import { v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { hoggiesOwnedBy } from "../album/hoggies/collection";
import { hoggiesShownTo } from "../album/hoggies/flag";
import type { DayKey } from "../engine/allowance";
import { countingPrimaryGroupOf, groupsShownTo, primaryMembersOf } from "../groups/groups";
import { ranking, windowOf } from "../leaderboard/board";
import { boardPeopleOf, peopleIn, type BoardPerson, type BoardViewer } from "../leaderboard/boards";
import { fewestMembersListed } from "../leaderboard/groupsBoard";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { companyTeammateOf, type Face } from "./faces";

export const hugMeasureValidator = v.union(v.literal("hugsGiven"), v.literal("hugsReceived"), v.literal("kudosReceived"), v.literal("level"), v.literal("hoggies"));

export type HugMeasure = Infer<typeof hugMeasureValidator>;

export type PersonRow = { person: MemberId; rank: number | null; name: string; face: Face; figure: number; you: boolean };

export type PeopleBoard = { rows: PersonRow[]; lastWeek: PersonRow[] | null };

export type TeamBoard = { name: string; rows: PersonRow[]; joinedIn: boolean; yetToJoin: number };

export type PeopleBoards = { measure: HugMeasure; people: PeopleBoard; team: TeamBoard | null };

export type BoardWeeks = { thisWeek: DayKey; lastWeek: DayKey };

type WeeklyMeasure = Extract<HugMeasure, "hugsGiven" | "hugsReceived" | "kudosReceived">;

type FigureOf = (person: BoardPerson) => number | Promise<number>;

type Week = { ctx: QueryCtx; viewer: BoardViewer; weeks: BoardWeeks; measure: HugMeasure; people: BoardPerson[]; you: BoardPerson | null };

const lastWeekShown = 3;

export async function peopleBoardsOf(ctx: QueryCtx, viewer: BoardViewer, measure: HugMeasure, weeks: BoardWeeks): Promise<PeopleBoards> {
  const people = await peopleIn(ctx, viewer, "week", weeks.thisWeek);
  const you = people.find(({ viewer: isViewer }) => isViewer) ?? (await boardPeopleOf(ctx, viewer, [viewer.member]))[0] ?? null;
  const week: Week = { ctx, viewer, weeks, measure, people, you };
  return { measure, people: await peopleBoardOf(week), team: await teamBoardOf(week) };
}

async function peopleBoardOf(week: Week): Promise<PeopleBoard> {
  const rows = windowed(await rowsOf(await rankedPeopleOf(week), figureOf(week)));
  if (!isWeekly(week.measure) || rows.some(({ rank }) => rank !== null)) return { rows, lastWeek: null };
  return { rows, lastWeek: (await rowsOf(await lastWeeksPeopleOf(week), figureOf(week))).filter(({ rank }) => rank !== null).slice(0, lastWeekShown) };
}

async function rankedPeopleOf(week: Week): Promise<BoardPerson[]> {
  const withYou = withPerson(week.people, week.you);
  return isWeekly(week.measure) ? withYou : withPeople(withYou, await lastWeeksPeopleOf(week));
}

function lastWeeksPeopleOf({ ctx, viewer, weeks }: Week): Promise<BoardPerson[]> {
  return peopleIn(ctx, viewer, "week", weeks.lastWeek);
}

async function teamBoardOf(week: Week): Promise<TeamBoard | null> {
  const { ctx, viewer } = week;
  if (!(await groupsShownTo(ctx, viewer.member))) return null;
  const group = await countingPrimaryGroupOf(ctx, viewer.member);
  const members = group === null ? [] : await primaryMembersOf(ctx, group.group);
  if (group === null || members.length < fewestMembersListed) return null;
  const team = await boardPeopleOf(ctx, viewer, members);
  const joinedIn = week.you !== null && hasJoinedIn(week.you);
  if (!isWeekly(week.measure)) return { name: group.name, rows: await rowsOf(team, figureOf(week)), joinedIn, yetToJoin: 0 };
  const joined = week.people.filter((person) => members.includes(person.member) && !person.viewer && hasJoinedIn(person));
  const teammates = team.filter((person) => !person.viewer).length;
  return { name: group.name, rows: await rowsOf(withPerson(joined, week.you), figureOf(week)), joinedIn, yetToJoin: teammates - joined.length };
}

function hasJoinedIn({ firstDay }: BoardPerson): boolean {
  return firstDay !== null;
}

function figureOf({ ctx, measure }: Week): FigureOf {
  switch (measure) {
    case "level":
      return async ({ member }) => (await standingOf(ctx, member)).level;
    case "hoggies":
      return async ({ member }) => ((await hoggiesShownTo(ctx, member)) ? hoggiesOwnedBy(ctx, member) : 0);
    default:
      return ({ counts }) => counts[measure];
  }
}

async function rowsOf(people: BoardPerson[], figureOf: FigureOf): Promise<PersonRow[]> {
  const figured = await Promise.all(people.map(async (person) => ({ id: person.member, name: person.name ?? "", value: await figureOf(person), person })));
  const ranked = ranking(figured, null).rows.map(({ person, value, rank }) => rowOf(person, value, rank));
  const unranked = figured.filter(({ value }) => value === 0).toSorted((first, second) => first.name.localeCompare(second.name));
  return [...ranked, ...unranked.map(({ person }) => rowOf(person, 0, null))];
}

function rowOf({ member, name, picture, face, viewer }: BoardPerson, figure: number, rank: number | null): PersonRow {
  return { person: member, rank, ...companyTeammateOf(name, picture, face), figure, you: viewer };
}

function windowed(rows: PersonRow[]): PersonRow[] {
  const ranked = rows.filter(({ rank }) => rank !== null);
  const shown = new Set(windowOf(ranked.length, ranked.findIndex(({ you }) => you) + 1));
  return [...ranked.filter((_, index) => shown.has(index + 1)), ...rows.filter(({ rank, you }) => rank === null && you)];
}

function withPerson(people: BoardPerson[], person: BoardPerson | null): BoardPerson[] {
  return person === null ? people : withPeople(people, [person]);
}

function withPeople(people: BoardPerson[], more: BoardPerson[]): BoardPerson[] {
  const known = new Set(people.map(({ member }) => member));
  return [...people, ...more.filter(({ member }) => !known.has(member))];
}

function isWeekly(measure: HugMeasure): measure is WeeklyMeasure {
  return measure !== "level" && measure !== "hoggies";
}
