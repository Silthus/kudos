import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { countsAsGroup, groupModeOf, groupsShownTo, memberGroupsOf, primaryMembersOf, userGroupsIn, type GroupId } from "../groups/groups";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { groupMemberTotalsOf, groupPeriodTotalOf, memberTotalsOf, type MemberTotals } from "./groupTotals";
import { fewestMembersListed, groupsBoard, type GroupFacts, type GroupsBoard, type Tally } from "./groupsBoard";
import { myGroupBoardOf, type GroupKudos, type MyGroupBoard, type Viewer } from "./myGroupBoard";
import { comparedOn, keyOf, periodValidator, type Compared, type ComparedPeriod, type Period, type PeriodKey, type SameDay } from "./periods";
import { totalUpTo } from "./runningTotal";

export type GroupBoards = { groups: GroupsBoard<GroupId> | null; myGroup: MyGroupBoard | null };

type GroupMembers = { group: GroupId; name: string; members: MemberId[] };

type Total = { kudos: number; runningTotal?: number[] };

type GroupRead = { facts: GroupFacts<GroupId>; kudos: GroupKudos };

type GroupsBoardRead = { board: GroupsBoard<GroupId>; viewer: Viewer; compared: Compared; viewersGroup: GroupKudos | undefined };

const nothing: Tally = { kudos: 0, givers: 0 };

export const groupsBoardOf = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: periodValidator },
  handler: async (ctx, { workspace, viewer, period }) => (await groupsBoardReadOf(ctx, workspace, viewer, period))?.board ?? null,
});

export async function groupBoardsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<GroupBoards> {
  const read = await groupsBoardReadOf(ctx, workspace, viewer, period);
  if (read === null) return { groups: null, myGroup: null };
  const myGroup = read.viewersGroup === undefined ? null : await myGroupBoardOf(ctx, read.viewer, read.viewersGroup, read.compared);
  return { groups: read.board, myGroup };
}

async function groupsBoardReadOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<GroupsBoardRead | null> {
  const person = await lookup(ctx, workspace, viewer);
  if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return null;
  const today = allowanceDay(Date.now(), person.timeZone);
  const compared = comparedOn(period, today);
  const viewerGroup = (await memberGroupsOf(ctx, person.member))?.primary ?? null;
  const groups = await Promise.all((await countingGroupsWithPrimaryMembersIn(ctx, workspace)).map((group) => groupReadOf(ctx, group, compared, group.group === viewerGroup)));
  const best = period === "all" || viewerGroup === null ? null : await bestCompletedPeriod(ctx, viewerGroup, period, today);
  const board = groupsBoard({ period, viewerGroup, best, groups: groups.map(({ facts }) => facts) });
  const viewersGroup = groups.find(({ facts }) => facts.group === viewerGroup)?.kudos;
  return { board, viewer: { user: viewer, member: person.member }, compared, viewersGroup };
}

export async function workspaceGroupsBoardOf(ctx: QueryCtx, workspace: string, compared: Compared): Promise<GroupsBoard<GroupId>> {
  const groups = await Promise.all((await countingGroupsWithPrimaryMembersIn(ctx, workspace)).map((group) => groupReadOf(ctx, group, compared, true)));
  return groupsBoard({ period: "week", viewerGroup: null, best: null, groups: groups.map(({ facts }) => facts) });
}

export async function groupsBoardShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  if (!(await groupsShownTo(ctx, member))) return false;
  const groups = await countingGroupsWithPrimaryMembersIn(ctx, (await chatUserOf(ctx, member)).workspace);
  return groups.some(({ members }) => members.length >= fewestMembersListed);
}

async function countingGroupsWithPrimaryMembersIn(ctx: QueryCtx, workspace: string): Promise<GroupMembers[]> {
  const mode = await groupModeOf(ctx, workspace);
  const groups: GroupMembers[] = [];
  for await (const row of userGroupsIn(ctx, workspace)) {
    if (!countsAsGroup(row, mode)) continue;
    const members = await primaryMembersOf(ctx, row._id);
    if (members.length > 0) groups.push({ group: row._id, name: row.name, members });
  }
  return groups;
}

async function groupReadOf(ctx: QueryCtx, { group, name, members }: GroupMembers, compared: Compared, readsWholeGroup: boolean): Promise<GroupRead> {
  const memberTotals = readsWholeGroup ? await groupMemberTotalsOf(ctx, group, members, compared) : await Promise.all(members.map((member) => memberTotalsOf(ctx, member, group, compared)));
  return { facts: await factsOf(ctx, { group, name, members }, memberTotals, compared), kudos: { group: { group, name }, members: memberTotals } };
}

async function factsOf(ctx: QueryCtx, { group, name, members }: GroupMembers, memberTotals: MemberTotals[], { now, before }: Compared): Promise<GroupFacts<GroupId>> {
  const nowTally = { kudos: kudosIn(await groupPeriodTotalOf(ctx, group, now)), givers: giversIn(memberTotals, now, kudosIn) };
  const beforeTally = before === null ? nothing : await tallyUpToTheSameDay(ctx, group, memberTotals, before);
  return { group, name, members: members.length, now: nowTally, before: beforeTally };
}

async function tallyUpToTheSameDay(ctx: QueryCtx, group: GroupId, memberTotals: MemberTotals[], { key, day }: SameDay): Promise<Tally> {
  const upToTheSameDay = (total: Total | null | undefined) => totalUpTo(total?.runningTotal ?? [], day);
  return { kudos: upToTheSameDay(await groupPeriodTotalOf(ctx, group, key)), givers: giversIn(memberTotals, key, upToTheSameDay) };
}

function giversIn(memberTotals: MemberTotals[], period: PeriodKey, kudosOf: (total: Total | undefined) => number) {
  return memberTotals.filter(({ totals }) => kudosOf(totals.find((total) => total.period === period)) > 0).length;
}

function kudosIn(total: Total | null | undefined) {
  return total?.kudos ?? 0;
}

async function bestCompletedPeriod(ctx: QueryCtx, group: GroupId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("attributedGroupTotals")
    .withIndex("by_group_period", (q) => q.eq("group", group).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map(({ kudos }) => kudos));
}
