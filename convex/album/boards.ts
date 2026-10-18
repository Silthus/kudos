import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import type { CompanyFace } from "../companyProfiles/faces";
import { storedCompanyMatchOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import { allowanceDay } from "../engine/allowance";
import { ranking } from "../leaderboard/board";
import { isOnTheBoards } from "../leaderboard/visibility";
import { givingWeekOf } from "../progression/progress";
import { currentNameAndPictureOf, timeZoneOf, type MemberId } from "../workspace/directory";

export type Standing = { rank: number; tied: boolean } | { rank: null; tied: false };

export type BoardPerson = { member: MemberId; name: string | undefined; picture: string | null; face: CompanyFace | null; teams: string[]; thoughtful: number; viewer: boolean };

export type BoardTeam = { team: string; name: string; art: TeamCrestArt; thoughtful: number; mine: boolean };

export type ThoughtfulBoards = {
  people: Array<BoardPerson & Standing>;
  teams: Array<BoardTeam & Standing>;
  pinned: { me: (BoardPerson & Standing) | null; teams: Array<BoardTeam & Standing> };
  onTheBoards: boolean;
};

export type BoardViewer = { workspace: string; member: MemberId };

type Profile = number | null;

type Giver = { person: BoardPerson; profile: Profile };

const unranked = { rank: null, tied: false } as const;

export async function countThoughtfulAwards(ctx: MutationCtx, { workspace, giver, day }: KudosGivenEvent, awards: number) {
  if (awards === 0) return;
  const week = givingWeekOf(day);
  const tally = await tallyOf(ctx, workspace, week, giver);
  if (tally === null) await ctx.db.insert("thoughtfulTallies", { workspace, week, giver, awards });
  else await ctx.db.patch(tally._id, { awards: tally.awards + awards });
}

export async function thoughtfulBoardsOf(ctx: QueryCtx, viewer: BoardViewer, whoGave: string | null): Promise<ThoughtfulBoards> {
  const companyTeams = await companyTeamsOf(ctx);
  const givers = await giversThisWeekOf(ctx, viewer, companyTeams);
  const people = placed(givers.map(({ person }) => person));
  const totals = teamTotalsOf(companyTeams, givers, await profileOf(ctx, viewer));
  const teams = placed(totals);
  const onTheBoards = await isOnTheBoards(ctx, viewer.member);
  return {
    people: whoGave === null ? people : people.filter(({ teams: theirs }) => theirs.includes(whoGave)),
    teams,
    pinned: { me: onTheBoards ? (people.find(({ viewer: isViewer }) => isViewer) ?? (await unrankedViewerOf(ctx, viewer, companyTeams))) : null, teams: myTeamsAmong(totals, teams) },
    onTheBoards,
  };
}

async function giversThisWeekOf(ctx: QueryCtx, viewer: BoardViewer, companyTeams: CompanyTeam[]): Promise<Giver[]> {
  const week = givingWeekOf(allowanceDay(Date.now(), (await timeZoneOf(ctx, viewer.member)) ?? undefined));
  const tallies = await ctx.db
    .query("thoughtfulTallies")
    .withIndex("by_workspace_week_giver", (q) => q.eq("workspace", viewer.workspace).eq("week", week))
    .collect();
  const givers = await Promise.all(tallies.map(async ({ giver, awards }) => ((await isOnTheBoards(ctx, giver)) ? giverOf(ctx, viewer, giver, awards, companyTeams) : null)));
  return givers.filter((giver) => giver !== null);
}

async function giverOf(ctx: QueryCtx, viewer: BoardViewer, member: MemberId, thoughtful: number, companyTeams: CompanyTeam[]): Promise<Giver | null> {
  const nameAndPicture = await currentNameAndPictureOf(ctx, member);
  if (nameAndPicture === null) return null;
  const match = await storedCompanyMatchOf(ctx, viewer.workspace, member);
  const profile = match?.profile ?? null;
  return { person: { member, ...nameAndPicture, face: match?.face ?? null, teams: teamsOf(companyTeams, profile), thoughtful, viewer: member === viewer.member }, profile };
}

async function unrankedViewerOf(ctx: QueryCtx, viewer: BoardViewer, companyTeams: CompanyTeam[]): Promise<(BoardPerson & Standing) | null> {
  const me = await giverOf(ctx, viewer, viewer.member, 0, companyTeams);
  return me === null ? null : { ...me.person, ...unranked };
}

function teamTotalsOf(companyTeams: CompanyTeam[], givers: Giver[], myProfile: Profile): BoardTeam[] {
  return companyTeams.map(({ team, name, crest, people }) => ({
    team,
    name,
    art: crest,
    thoughtful: givers.filter(({ profile }) => profile !== null && people.includes(profile)).reduce((sum, { person }) => sum + person.thoughtful, 0),
    mine: myProfile !== null && people.includes(myProfile),
  }));
}

function myTeamsAmong(totals: BoardTeam[], teams: Array<BoardTeam & Standing>): Array<BoardTeam & Standing> {
  return totals.filter(({ mine }) => mine).map((total) => teams.find(({ team }) => team === total.team) ?? { ...total, ...unranked });
}

function placed<Row extends { name: string | undefined; thoughtful: number }>(rows: Row[]): Array<Row & Standing> {
  const entries = rows.map((row, index) => ({ row, id: String(index), name: row.name ?? "", value: row.thoughtful }));
  return ranking(entries, null).rows.map(({ row, rank, tied }) => ({ ...row, rank, tied }));
}

function teamsOf(companyTeams: CompanyTeam[], profile: Profile): string[] {
  return profile === null ? [] : companyTeams.filter(({ people }) => people.includes(profile)).map(({ team }) => team);
}

async function profileOf(ctx: QueryCtx, { workspace, member }: BoardViewer): Promise<Profile> {
  return (await storedCompanyMatchOf(ctx, workspace, member))?.profile ?? null;
}

function tallyOf(ctx: QueryCtx, workspace: string, week: string, giver: MemberId) {
  return ctx.db
    .query("thoughtfulTallies")
    .withIndex("by_workspace_week_giver", (q) => q.eq("workspace", workspace).eq("week", week).eq("giver", giver))
    .unique();
}
