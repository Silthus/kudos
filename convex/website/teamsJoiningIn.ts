import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { normalisedName } from "../companyProfiles/faces";
import { companyTeamsOf, type CompanyTeam, type TeamCrestArt } from "../companyProfiles/teams";
import type { DayKey } from "../engine/allowance";
import { countsAsGroup, groupModeOf, groupsShownTo, memberGroupsOf, primaryMembersOf, userGroupsIn, type GroupId } from "../groups/groups";
import type { BoardViewer } from "../leaderboard/boards";
import { totalsIn, weekCountedBy } from "../leaderboard/counts";
import { ranking } from "../leaderboard/board";
import { fewestMembersListed } from "../leaderboard/groupsBoard";
import { dayOfPeriod, keyOf, lastPeriodUpToTheSameDay } from "../leaderboard/periods";
import { isOnTheBoards } from "../leaderboard/visibility";
import type { MemberId } from "../workspace/directory";

export type JoiningStanding = { rank: number; gain: number };

export type JoiningTeam = { group: GroupId; name: string; team: string | null; art: TeamCrestArt; joined: number; of: number; standing: JoiningStanding | null; mine: boolean };

export type TeamsJoiningIn = { teams: JoiningTeam[] };

export type JoiningWeeks = { today: DayKey; thisWeek: DayKey; lastWeek: DayKey };

type Team = { row: Doc<"userGroups">; members: MemberId[] };

type Scored = { team: Omit<JoiningTeam, "standing">; gain: number | null };

type Comparison = { joinedNow: Set<MemberId>; joinedBefore: Set<MemberId>; comparableSince: number | null };

const dayMs = 24 * 60 * 60 * 1000;

const sunday = 6;

const wordsAroundATeamName = new Set(["team", "folks"]);

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
  return {
    joinedNow: await joinedIn(ctx, workspace, thisWeek, sunday),
    joinedBefore: await joinedIn(ctx, workspace, lastWeek, dayOfPeriod("week", today)),
    comparableSince: (await weekCountedBy(ctx, workspace, lastWeek)) ? endOfTheSameWeekdayLastWeek(today) : null,
  };
}

async function joinedIn(ctx: QueryCtx, workspace: string, monday: DayKey, byWeekday: number): Promise<Set<MemberId>> {
  const totals = await totalsIn(ctx, workspace, keyOf("week", monday));
  return new Set(totals.flatMap(({ member, firstDay }) => (firstDay !== null && dayOfPeriod("week", firstDay) <= byWeekday ? [member] : [])));
}

function endOfTheSameWeekdayLastWeek(today: DayKey): number {
  return Date.parse(`${lastPeriodUpToTheSameDay("week", today).last}T00:00:00Z`) + dayMs;
}

function scored({ row, members }: Team, { joinedNow, joinedBefore, comparableSince }: Comparison, companyTeams: Map<string, CompanyTeam>, mine: GroupId | null): Scored {
  const joined = members.filter((member) => joinedNow.has(member)).length;
  const before = members.filter((member) => joinedBefore.has(member)).length;
  const comparable = comparableSince !== null && row._creationTime < comparableSince;
  const companyTeam = companyTeams.get(teamNameKey(row.name)) ?? null;
  return {
    team: { group: row._id, name: row.name, team: companyTeam?.team ?? null, art: companyTeam?.crest ?? null, joined, of: members.length, mine: row._id === mine },
    gain: comparable ? Math.round((100 * (joined - before)) / members.length) : null,
  };
}

function ranked(teams: Scored[]): JoiningTeam[] {
  const gaining = ranking(
    teams.map(({ team, gain }) => ({ id: team.group, name: team.name, value: gain ?? 0, team })),
    null,
  ).rows.map(({ team, rank, value }) => ({ ...team, standing: { rank, gain: value } }));
  const folded = teams.filter(({ gain }) => gain === null || gain <= 0).map(({ team }) => ({ ...team, standing: null }));
  return [...gaining, ...folded.toSorted((first, second) => first.name.localeCompare(second.name))];
}

function companyTeamsByName(teams: CompanyTeam[]): Map<string, CompanyTeam> {
  return new Map(teams.map((team) => [teamNameKey(team.name), team]));
}

function teamNameKey(name: string): string {
  return normalisedName(name.replaceAll("&", " and "))
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "" && !wordsAroundATeamName.has(word))
    .join(" ");
}
