import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CompanyFace } from "../companyProfiles/faces";
import { storedCompanyMatchOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import type { AwardId } from "../engine/awards";
import { ranking } from "../leaderboard/board";
import { allTimeKey, keyOf, periods, wholeWeekBefore, type Period, type PeriodKey } from "../leaderboard/periods";
import { isOnTheBoards } from "../leaderboard/visibility";
import { countThoughtfulGiver } from "./thoughtfulGivers";
import { currentNameAndPictureOf, timeZoneOf, type MemberId } from "../workspace/directory";

export const boardPeriodValidator = v.union(v.literal("week"), v.literal("last-week"), v.literal("month"), v.literal("all"));

export type BoardPeriod = Infer<typeof boardPeriodValidator>;

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

type BoardReader = { workspace: string; member: MemberId | null };

export type AllTimeBoards = Pick<ThoughtfulBoards, "people" | "teams">;

export type BoardsAsked = { whoGave: string | null; period: BoardPeriod };

export type ThoughtfulAward = { award: AwardId; workspace: string; giver: MemberId; day: DayKey };

type Profile = number | null;

type Giver = { person: BoardPerson; profile: Profile };

const unranked = { rank: null, tied: false } as const;

export async function countOnTheBoardsOnce(ctx: MutationCtx, { award, workspace, giver, day }: ThoughtfulAward) {
  if ((await boardCountOf(ctx, award)) !== null) return;
  await ctx.db.insert("boardCountedAwards", { award });
  for (const period of periods) {
    const key = keyOf(period, day);
    const tally = await tallyOf(ctx, workspace, key, giver);
    if (tally === null) await firstTallyOf(ctx, { workspace, period, key, giver });
    else await ctx.db.patch(tally._id, { awards: tally.awards + 1 });
  }
}

async function firstTallyOf(ctx: MutationCtx, { workspace, period, key, giver }: { workspace: string; period: Period; key: PeriodKey; giver: MemberId }) {
  await ctx.db.insert("thoughtfulBoardTallies", { workspace, period: key, giver, awards: 1 });
  if (period === "week") await countThoughtfulGiver(ctx, workspace, key);
}

export async function hasGivenAThoughtfulAward(ctx: QueryCtx, workspace: string, giver: MemberId): Promise<boolean> {
  return (await tallyOf(ctx, workspace, allTimeKey, giver)) !== null;
}

export async function thoughtfulBoardsOf(ctx: QueryCtx, viewer: BoardViewer, { whoGave, period }: BoardsAsked): Promise<ThoughtfulBoards> {
  const companyTeams = await companyTeamsOf(ctx);
  const givers = await giversOf(ctx, viewer, period, companyTeams);
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

export async function allTimeBoardsIn(ctx: QueryCtx, workspace: string): Promise<AllTimeBoards> {
  const companyTeams = await companyTeamsOf(ctx);
  const givers = await giversIn(ctx, { workspace, member: null }, allTimeKey, companyTeams);
  return { people: placed(givers.map(({ person }) => person)), teams: placed(teamTotalsOf(companyTeams, givers, null)) };
}

async function giversOf(ctx: QueryCtx, viewer: BoardViewer, period: BoardPeriod, companyTeams: CompanyTeam[]): Promise<Giver[]> {
  const today = allowanceDay(Date.now(), (await timeZoneOf(ctx, viewer.member)) ?? undefined);
  return giversIn(ctx, viewer, periodKeyOf(period, today), companyTeams);
}

async function giversIn(ctx: QueryCtx, reader: BoardReader, period: PeriodKey, companyTeams: CompanyTeam[]): Promise<Giver[]> {
  const tallies = await ctx.db
    .query("thoughtfulBoardTallies")
    .withIndex("by_workspace_period_giver", (q) => q.eq("workspace", reader.workspace).eq("period", period))
    .collect();
  const givers = await Promise.all(tallies.map(async ({ giver, awards }) => ((await isOnTheBoards(ctx, giver)) ? giverOf(ctx, reader, giver, awards, companyTeams) : null)));
  return givers.filter((giver) => giver !== null);
}

function periodKeyOf(period: BoardPeriod, today: DayKey): PeriodKey {
  return period === "last-week" ? wholeWeekBefore(weekOf(today).monday).now : keyOf(period, today);
}

async function giverOf(ctx: QueryCtx, reader: BoardReader, member: MemberId, thoughtful: number, companyTeams: CompanyTeam[]): Promise<Giver | null> {
  const nameAndPicture = await currentNameAndPictureOf(ctx, member);
  if (nameAndPicture === null) return null;
  const match = await storedCompanyMatchOf(ctx, reader.workspace, member);
  const profile = match?.profile ?? null;
  return { person: { member, ...nameAndPicture, face: match?.face ?? null, teams: teamsOf(companyTeams, profile), thoughtful, viewer: member === reader.member }, profile };
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

function boardCountOf(ctx: QueryCtx, award: AwardId) {
  return ctx.db
    .query("boardCountedAwards")
    .withIndex("by_award", (q) => q.eq("award", award))
    .unique();
}

function tallyOf(ctx: QueryCtx, workspace: string, period: PeriodKey, giver: MemberId) {
  return ctx.db
    .query("thoughtfulBoardTallies")
    .withIndex("by_workspace_period_giver", (q) => q.eq("workspace", workspace).eq("period", period).eq("giver", giver))
    .unique();
}
