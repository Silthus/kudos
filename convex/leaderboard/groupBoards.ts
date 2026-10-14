import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { countsAsGroup, groupModeOf, groupsShownTo, memberGroupsOf, primaryMembersOf, userGroupsIn, type GroupId } from "../groups/groups";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { groupPeriodTotalOf } from "./groupTotals";
import { fewestMembersListed, groupsBoard, type GroupFacts, type GroupsBoard, type Tally } from "./groupsBoard";
import { keyOf, periodValidator, sameDayLastPeriod, type ComparedPeriod, type Period, type PeriodKey, type SameDay } from "./periods";
import { totalUpTo } from "./runningTotal";

export type GroupBoards = { groups: GroupsBoard<GroupId> | null };

type GroupMembers = { group: GroupId; name: string; members: MemberId[] };

type Compared = { now: PeriodKey; before: SameDay | null };

type Total = { kudos: number; runningTotal?: number[] };

type MemberTotals = Array<Doc<"attributedTotals">>;

const nothing: Tally = { kudos: 0, givers: 0 };

export const groupsBoardOf = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: periodValidator },
  handler: async (ctx, { workspace, viewer, period }) => (await groupBoardsOf(ctx, workspace, viewer, period)).groups,
});

export async function groupBoardsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<GroupBoards> {
  const person = await lookup(ctx, workspace, viewer);
  if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return { groups: null };
  const today = allowanceDay(Date.now(), person.timeZone);
  const compared = { now: keyOf(period, today), before: period === "all" ? null : sameDayLastPeriod(period, today) };
  const groups = await Promise.all((await countingGroupsWithPrimaryMembersIn(ctx, workspace)).map((group) => factsOf(ctx, group, compared)));
  const viewerGroup = (await memberGroupsOf(ctx, person.member))?.primary ?? null;
  const best = period === "all" || viewerGroup === null ? null : await bestCompletedPeriod(ctx, viewerGroup, period, today);
  return { groups: groupsBoard({ period, viewerGroup, best, groups }) };
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

async function factsOf(ctx: QueryCtx, { group, name, members }: GroupMembers, { now, before }: Compared): Promise<GroupFacts<GroupId>> {
  const memberTotals = await Promise.all(members.map((member) => memberTotalsOf(ctx, member, group, before?.key ?? now, now)));
  const nowTally = { kudos: kudosIn(await groupPeriodTotalOf(ctx, group, now)), givers: giversIn(memberTotals, now, kudosIn) };
  const beforeTally = before === null ? nothing : await tallyUpToTheSameDay(ctx, group, memberTotals, before);
  return { group, name, members: members.length, now: nowTally, before: beforeTally };
}

async function tallyUpToTheSameDay(ctx: QueryCtx, group: GroupId, memberTotals: MemberTotals[], { key, day }: SameDay): Promise<Tally> {
  const upToTheSameDay = (total: Total | null | undefined) => totalUpTo(total?.runningTotal ?? [], day);
  return { kudos: upToTheSameDay(await groupPeriodTotalOf(ctx, group, key)), givers: giversIn(memberTotals, key, upToTheSameDay) };
}

function giversIn(memberTotals: MemberTotals[], period: PeriodKey, kudosOf: (total: Total | undefined) => number) {
  return memberTotals.filter((totals) => kudosOf(totals.find((total) => total.period === period)) > 0).length;
}

function kudosIn(total: Total | null | undefined) {
  return total?.kudos ?? 0;
}

function memberTotalsOf(ctx: QueryCtx, member: MemberId, group: GroupId, first: PeriodKey, last: PeriodKey): Promise<MemberTotals> {
  return ctx.db
    .query("attributedTotals")
    .withIndex("by_member_group_period", (q) => q.eq("member", member).eq("group", group).gte("period", first).lte("period", last))
    .collect();
}

async function bestCompletedPeriod(ctx: QueryCtx, group: GroupId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("attributedGroupTotals")
    .withIndex("by_group_period", (q) => q.eq("group", group).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map(({ kudos }) => kudos));
}
