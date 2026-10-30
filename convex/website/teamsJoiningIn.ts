import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { normalisedName } from "../companyProfiles/faces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import type { DayKey } from "../engine/allowance";
import { countsAsGroup, groupModeOf, groupsShownTo, memberGroupsOf, primaryMembersOf, userGroupsIn, type GroupId } from "../groups/groups";
import type { BoardViewer } from "../leaderboard/boards";
import { totalsIn } from "../leaderboard/counts";
import { fewestMembersListed } from "../leaderboard/groupsBoard";
import { dayOfPeriod, keyOf, lastPeriodUpToTheSameDay } from "../leaderboard/periods";
import { isOnTheBoards } from "../leaderboard/visibility";
import type { MemberId } from "../workspace/directory";

export type JoiningStanding = { rank: number; gain: number };

export type JoiningTeam = { group: GroupId; name: string; team: string | null; art: TeamCrestArt; joined: number; of: number; standing: JoiningStanding | null; mine: boolean };

export type TeamsJoiningIn = { teams: JoiningTeam[] };

export type JoiningWeeks = { today: DayKey; thisWeek: DayKey; lastWeek: DayKey };

type Team = { row: Doc<"userGroups">; members: MemberId[] };

type Scored = Omit<JoiningTeam, "standing"> & { gain: number | null };

type Comparison = { joinedNow: Set<MemberId>; joinedBefore: Set<MemberId>; comparableSince: number | null };

const dayMs = 24 * 60 * 60 * 1000;

export async function teamsJoiningInOf(ctx: QueryCtx, viewer: BoardViewer, weeks: JoiningWeeks): Promise<TeamsJoiningIn | null> {
  if (!(await groupsShownTo(ctx, viewer.member))) return null;
  const teams = await teamsIn(ctx, viewer.workspace);
  if (teams.length === 0) return null;
  const comparison = await comparisonOf(ctx, viewer.workspace, weeks);
  const companyTeams = companyTeamsByName(await companyTeamsOf(ctx));
  const mine = (await memberGroupsOf(ctx, viewer.member))?.primary ?? null;
  return { teams: ranked(teams.map((team) => scored(team, comparison, companyTeams, mine))) };
}

async function teamsIn(ctx: QueryCtx, workspace: string): Promise<Team[]> {
  const mode = await groupModeOf(ctx, workspace);
  const teams: Team[] = [];
  for await (const row of userGroupsIn(ctx, workspace)) {
    if (!countsAsGroup(row, mode)) continue;
    const members = await primaryMembersOf(ctx, row._id);
    if (members.length < fewestMembersListed) continue;
    const onTheBoards = await membersOnTheBoards(ctx, members);
    if (onTheBoards.length > 0) teams.push({ row, members: onTheBoards });
  }
  return teams;
}

async function membersOnTheBoards(ctx: QueryCtx, members: MemberId[]): Promise<MemberId[]> {
  const visible = await Promise.all(members.map((member) => isOnTheBoards(ctx, member)));
  return members.filter((_, index) => visible[index]);
}

async function comparisonOf(ctx: QueryCtx, workspace: string, { today, thisWeek, lastWeek }: JoiningWeeks): Promise<Comparison> {
  const weekday = dayOfPeriod("week", today);
  return {
    joinedNow: await joinedIn(ctx, workspace, thisWeek, () => true),
    joinedBefore: await joinedIn(ctx, workspace, lastWeek, (firstDay) => dayOfPeriod("week", firstDay) <= weekday),
    comparableSince: (await wasCountedBy(ctx, workspace, lastWeek)) ? endOfTheSameWeekdayLastWeek(today) : null,
  };
}

async function joinedIn(ctx: QueryCtx, workspace: string, monday: DayKey, counts: (firstDay: DayKey) => boolean): Promise<Set<MemberId>> {
  const totals = await totalsIn(ctx, workspace, keyOf("week", monday));
  return new Set(totals.flatMap(({ member, firstDay }) => (firstDay !== null && counts(firstDay) ? [member] : [])));
}

async function wasCountedBy(ctx: QueryCtx, workspace: string, monday: DayKey): Promise<boolean> {
  const earliest = await ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).gte("period", "week:").lte("period", keyOf("week", monday)))
    .first();
  return earliest !== null;
}

function endOfTheSameWeekdayLastWeek(today: DayKey): number {
  return Date.parse(`${lastPeriodUpToTheSameDay("week", today).last}T00:00:00Z`) + dayMs;
}

function scored({ row, members }: Team, { joinedNow, joinedBefore, comparableSince }: Comparison, companyTeams: Map<string, CompanyTeam>, mine: GroupId | null): Scored {
  const joined = members.filter((member) => joinedNow.has(member)).length;
  const before = members.filter((member) => joinedBefore.has(member)).length;
  const comparable = comparableSince !== null && row._creationTime < comparableSince;
  const companyTeam = companyTeams.get(normalisedName(row.name)) ?? null;
  return {
    group: row._id,
    name: row.name,
    team: companyTeam?.team ?? null,
    art: companyTeam?.crest ?? null,
    joined,
    of: members.length,
    gain: comparable ? Math.round((100 * (joined - before)) / members.length) : null,
    mine: row._id === mine,
  };
}

function ranked(teams: Scored[]): JoiningTeam[] {
  const gaining = teams.filter(isGaining);
  const standingOf = (gain: number) => ({ rank: 1 + gaining.filter((other) => other.gain > gain).length, gain });
  const rows = teams.map(({ gain, ...team }) => ({ ...team, standing: gain !== null && gain > 0 ? standingOf(gain) : null }));
  return rows.toSorted((first, second) => byStanding(first, second) || first.name.localeCompare(second.name));
}

function isGaining(team: Scored): team is Scored & { gain: number } {
  return team.gain !== null && team.gain > 0;
}

function byStanding({ standing: first }: JoiningTeam, { standing: second }: JoiningTeam): number {
  if (first === null || second === null) return (first === null ? 1 : 0) - (second === null ? 1 : 0);
  return first.rank - second.rank;
}

function companyTeamsByName(teams: CompanyTeam[]): Map<string, CompanyTeam> {
  return new Map(teams.map((team) => [normalisedName(team.name), team]));
}
