import type { QueryCtx } from "../_generated/server";
import type { ViewedBoard } from "../analytics/projections";
import type { CompanyFace } from "../companyProfiles/faces";
import { storedCompanyMatchOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { ranking } from "./board";
import { totalsIn, type MemberTotals, type RecognitionCounts } from "./counts";
import { groupsBoardShownTo } from "./groupBoards";
import { myGroupBoardShownTo } from "./myGroupBoard";
import { keyOf, type Period } from "./periods";
import { isOnTheBoards } from "./visibility";
import { currentNameAndPictureOf, timeZoneOf, type MemberId } from "../workspace/directory";

export type Measure = keyof RecognitionCounts;

export type BoardViewer = { workspace: string; member: MemberId };

export type BoardsAsked = { period: Period; team: string | null };

export type Standing = { rank: number; tied: boolean };

export type BoardPerson = { member: MemberId; name: string | undefined; picture: string | null; face: CompanyFace | null; teams: string[]; counts: RecognitionCounts; firstDay: DayKey | null; viewer: boolean };

export type BoardTeam = { team: string; name: string; art: TeamCrestArt; counts: RecognitionCounts; mine: boolean };

export type Boards = { people: Record<Measure, Array<BoardPerson & Standing>>; teams: Record<Measure, Array<BoardTeam & Standing>>; me: BoardPerson | null; onTheBoards: boolean };

export type BoardPlace = { rank: number; tied: boolean; kudosGiven: number };

type Ranked = { name: string | undefined; counts: RecognitionCounts };

export async function boardsShownTo(ctx: QueryCtx, member: MemberId): Promise<ViewedBoard[]> {
  const groups: ViewedBoard[] = (await groupsBoardShownTo(ctx, member)) ? ["groups"] : [];
  const myGroup: ViewedBoard[] = (await myGroupBoardShownTo(ctx, member)) ? ["my-group"] : [];
  return ["everyone", ...groups, ...myGroup];
}

export async function boardsOf(ctx: QueryCtx, viewer: BoardViewer, { period, team }: BoardsAsked): Promise<Boards> {
  const companyTeams = await companyTeamsOf(ctx);
  const totals = await totalsIn(ctx, viewer.workspace, keyOf(period, await todayOf(ctx, viewer.member)));
  const people = await peopleOf(ctx, viewer, totals, companyTeams);
  const teams = teamTotalsOf(companyTeams, people, teamsOf(companyTeams, await profileOf(ctx, viewer)));
  const me = people.find(({ viewer: isViewer }) => isViewer) ?? (await personOf(ctx, viewer, nothingCountedBy(viewer.member), companyTeams));
  return {
    people: eachMeasure((measure) => placedBy(people, measure).filter(({ teams: theirs }) => team === null || theirs.includes(team))),
    teams: eachMeasure((measure) => placedBy(teams, measure)),
    me,
    onTheBoards: await isOnTheBoards(ctx, viewer.member),
  };
}

export async function placeOf(ctx: QueryCtx, member: BoardViewer, period: Period): Promise<BoardPlace | null> {
  if (!(await isRanked(ctx, member.member))) return null;
  const totals = await totalsIn(ctx, member.workspace, keyOf(period, await todayOf(ctx, member.member)));
  const kudosGiven = totals.find(({ member: other }) => other === member.member)?.kudosGiven ?? 0;
  if (kudosGiven === 0) return null;
  const rivals = await rankedAmong(ctx, totals.filter((other) => other.member !== member.member && other.kudosGiven >= kudosGiven));
  return { rank: rivals.filter((other) => other.kudosGiven > kudosGiven).length + 1, tied: rivals.some((other) => other.kudosGiven === kudosGiven), kudosGiven };
}

async function isRanked(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await rankedNameAndPictureOf(ctx, member)) !== null;
}

async function rankedNameAndPictureOf(ctx: QueryCtx, member: MemberId) {
  return (await isOnTheBoards(ctx, member)) ? currentNameAndPictureOf(ctx, member) : null;
}

async function rankedAmong(ctx: QueryCtx, totals: MemberTotals[]): Promise<MemberTotals[]> {
  const ranked = await Promise.all(totals.map(async (memberTotals) => ((await isRanked(ctx, memberTotals.member)) ? memberTotals : null)));
  return ranked.filter((memberTotals) => memberTotals !== null);
}

async function todayOf(ctx: QueryCtx, member: MemberId): Promise<DayKey> {
  return allowanceDay(Date.now(), (await timeZoneOf(ctx, member)) ?? undefined);
}

async function peopleOf(ctx: QueryCtx, viewer: BoardViewer, totals: MemberTotals[], companyTeams: CompanyTeam[]): Promise<BoardPerson[]> {
  const people = await Promise.all(totals.map((memberTotals) => personOf(ctx, viewer, memberTotals, companyTeams)));
  return people.filter((person) => person !== null);
}

async function personOf(ctx: QueryCtx, viewer: BoardViewer, { member, firstDay, ...counts }: MemberTotals, companyTeams: CompanyTeam[]): Promise<BoardPerson | null> {
  const nameAndPicture = await rankedNameAndPictureOf(ctx, member);
  if (nameAndPicture === null) return null;
  const match = await storedCompanyMatchOf(ctx, viewer.workspace, member);
  const profile = match?.profile ?? null;
  return { member, ...nameAndPicture, face: match?.face ?? null, teams: teamsOf(companyTeams, profile), counts, firstDay, viewer: member === viewer.member };
}

function nothingCountedBy(member: MemberId): MemberTotals {
  return { member, kudosGiven: 0, kudosReceived: 0, hugsGiven: 0, hugsReceived: 0, firstDay: null };
}

function teamTotalsOf(companyTeams: CompanyTeam[], people: BoardPerson[], myTeams: string[]): BoardTeam[] {
  return companyTeams.map(({ team, name, crest }) => {
    const members = people.filter(({ teams }) => teams.includes(team));
    return { team, name, art: crest, counts: eachMeasure((measure) => sumOf(members, measure)), mine: myTeams.includes(team) };
  });
}

function sumOf(people: BoardPerson[], measure: Measure): number {
  return people.reduce((sum, { counts }) => sum + counts[measure], 0);
}

async function profileOf(ctx: QueryCtx, { workspace, member }: BoardViewer): Promise<number | null> {
  return (await storedCompanyMatchOf(ctx, workspace, member))?.profile ?? null;
}

function teamsOf(companyTeams: CompanyTeam[], profile: number | null): string[] {
  return profile === null ? [] : companyTeams.filter(({ people }) => people.includes(profile)).map(({ team }) => team);
}

function eachMeasure<T>(of: (measure: Measure) => T): Record<Measure, T> {
  return { kudosGiven: of("kudosGiven"), kudosReceived: of("kudosReceived"), hugsGiven: of("hugsGiven"), hugsReceived: of("hugsReceived") };
}

function placedBy<Row extends Ranked>(rows: Row[], measure: Measure): Array<Row & Standing> {
  const entries = rows.map((row, index) => ({ row, id: String(index), name: row.name ?? "", value: row.counts[measure] }));
  return ranking(entries, null).rows.map(({ row, rank, tied }) => ({ ...row, rank, tied }));
}
