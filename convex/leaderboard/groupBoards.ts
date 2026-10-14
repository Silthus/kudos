import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { allowanceDay, type DayKey } from "../engine/allowance";
import { groupsShownTo, memberGroupsOf, primaryMembersOf, type GroupId } from "../groups/groups";
import { lookup, type MemberId } from "../workspace/directory";
import { groupsBoard, type GroupFacts, type GroupsBoard, type Tally } from "./groupsBoard";
import { keyOf, periodValidator, sameDayLastPeriod, type ComparedPeriod, type Period, type PeriodKey } from "./periods";
import { totalUpTo } from "./runningTotal";

export type GroupBoards = { groups: GroupsBoard<GroupId> | null };

type GroupMembers = { group: GroupId; name: string; members: Set<MemberId> };

type Tallies = Map<GroupId, Tally>;

type KudosOf = (total: Doc<"attributedTotals">) => number;

const nothing: Tally = { kudos: 0, givers: 0 };

export const groupsBoardOf = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: periodValidator },
  handler: async (ctx, { workspace, viewer, period }) => (await groupBoardsOf(ctx, workspace, viewer, period)).groups,
});

export async function groupBoardsOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<GroupBoards> {
  const person = await lookup(ctx, workspace, viewer);
  if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return { groups: null };
  const today = allowanceDay(Date.now(), person.timeZone);
  const groups = await groupsWithPrimaryMembersIn(ctx, workspace);
  const now = await tallied(ctx, workspace, keyOf(period, today), groups, (total) => total.kudos);
  const before = period === "all" ? new Map() : await talliedUpToTheSameDay(ctx, workspace, period, today, groups);
  const viewerGroup = (await memberGroupsOf(ctx, person.member))?.primary ?? null;
  const best = period === "all" || viewerGroup === null ? null : await bestCompletedPeriod(ctx, viewerGroup, period, today);
  return { groups: groupsBoard({ period, viewerGroup, best, groups: groups.map((group) => factsOf(group, now, before)) }) };
}

async function groupsWithPrimaryMembersIn(ctx: QueryCtx, workspace: string): Promise<GroupMembers[]> {
  const groups: GroupMembers[] = [];
  for await (const row of ctx.db.query("userGroups").withIndex("by_group", (q) => q.eq("workspace", workspace))) {
    const members = await primaryMembersOf(ctx, row._id);
    if (members.length > 0) groups.push({ group: row._id, name: row.name, members: new Set(members) });
  }
  return groups;
}

function talliedUpToTheSameDay(ctx: QueryCtx, workspace: string, period: ComparedPeriod, today: DayKey, groups: GroupMembers[]) {
  const { key, day } = sameDayLastPeriod(period, today);
  return tallied(ctx, workspace, key, groups, (total) => totalUpTo(total.runningTotal ?? [], day));
}

async function tallied(ctx: QueryCtx, workspace: string, period: PeriodKey, groups: GroupMembers[], kudosOf: KudosOf): Promise<Tallies> {
  const membersOf = new Map(groups.map(({ group, members }) => [group, members]));
  const tallies: Tallies = new Map();
  for await (const total of ctx.db.query("attributedTotals").withIndex("by_workspace_period", (q) => q.eq("workspace", workspace).eq("period", period))) {
    const kudos = kudosOf(total);
    const { kudos: sum, givers } = tallies.get(total.group) ?? nothing;
    const gave = kudos > 0 && membersOf.get(total.group)?.has(total.member) === true;
    tallies.set(total.group, { kudos: sum + kudos, givers: givers + (gave ? 1 : 0) });
  }
  return tallies;
}

function factsOf({ group, name, members }: GroupMembers, now: Tallies, before: Tallies): GroupFacts<GroupId> {
  return { group, name, members: members.size, now: now.get(group) ?? nothing, before: before.get(group) ?? nothing };
}

async function bestCompletedPeriod(ctx: QueryCtx, group: GroupId, period: ComparedPeriod, today: DayKey) {
  const completed = await ctx.db
    .query("attributedGroupTotals")
    .withIndex("by_group_period", (q) => q.eq("group", group).gt("period", `${period}:`).lt("period", keyOf(period, today)))
    .collect();
  return completed.length === 0 ? null : Math.max(...completed.map(({ kudos }) => kudos));
}
