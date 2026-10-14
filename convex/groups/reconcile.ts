import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { userGroupMembershipsOf, userGroupRow } from "../workspace/userGroups";
import { countsAsGroup, memberGroupsOf, type GroupId } from "./groups";
import { recordChange } from "./history";

const usersPerPage = 100;
const directoryRowsPerPage = 1_000;
const membershipsPerPage = 8_000;

export async function reconcileLater(ctx: MutationCtx, workspace: string, users: ChatUserId[], recordedAt?: number) {
  const sorted = users.toSorted();
  for (let start = 0; start < sorted.length; start += usersPerPage) {
    await ctx.scheduler.runAfter(0, internal.groups.reconcile.reconcileUsers, { workspace, users: sorted.slice(start, start + usersPerPage), recordedAt });
  }
}

export const reconcileUsers = internalMutation({
  args: { workspace: v.string(), users: v.array(v.string()), recordedAt: v.optional(v.number()) },
  handler: async (ctx, { workspace, users, recordedAt }) => {
    const sorted = users.toSorted();
    const [first, last] = [sorted[0], sorted.at(-1)];
    if (first === undefined || last === undefined) return;
    const people = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", workspace).gte("user", first).lte("user", last))
      .take(directoryRowsPerPage);
    const wanted = new Set(sorted);
    const groups = new GroupRows(ctx, workspace);
    for (const person of people) {
      if (!wanted.has(person.user)) continue;
      if (groups.membershipsRead >= membershipsPerPage) return reconcileLater(ctx, workspace, sorted.filter((user) => user >= person.user), recordedAt);
      await reconcile(ctx, person, groups, recordedAt);
    }
    const lastRead = people.at(-1)?.user;
    if (people.length === directoryRowsPerPage && lastRead !== undefined) await reconcileLater(ctx, workspace, sorted.filter((user) => user > lastRead), recordedAt);
  },
});

export async function reconcileUser(ctx: MutationCtx, workspace: string, user: ChatUserId, recordedAt?: number) {
  const person = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, workspace), recordedAt);
}

export async function reconcileMember(ctx: MutationCtx, member: MemberId, recordedAt?: number) {
  const person = await ctx.db.get(member);
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, person.workspace), recordedAt);
}

type CountingGroup = { row: Doc<"userGroups">; joinedAt: number };

class GroupRows {
  private readonly rows = new Map<string, Promise<Doc<"userGroups"> | null>>();
  private readonly rowsById = new Map<GroupId, Promise<Doc<"userGroups"> | null>>();
  membershipsRead = 0;

  constructor(
    private readonly ctx: MutationCtx,
    private readonly workspace: string,
  ) {}

  async countingOf(user: ChatUserId): Promise<CountingGroup[]> {
    const memberships = await userGroupMembershipsOf(this.ctx, this.workspace, user);
    this.membershipsRead += memberships.length;
    const groups = await Promise.all(memberships.map(async ({ group, _creationTime }) => ({ row: await this.rowOf(group), joinedAt: _creationTime })));
    return groups.filter((group): group is CountingGroup => group.row !== null && countsAsGroup(group.row));
  }

  leftGroupsOf(groups: GroupId[]): Promise<(Doc<"userGroups"> | null)[]> {
    this.membershipsRead += groups.length;
    return Promise.all(groups.map((group) => this.rowById(group)));
  }

  private rowOf(group: string) {
    const row = this.rows.get(group) ?? userGroupRow(this.ctx, { workspace: this.workspace, group });
    this.rows.set(group, row);
    return row;
  }

  private rowById(group: GroupId) {
    const row = this.rowsById.get(group) ?? this.ctx.db.get(group);
    this.rowsById.set(group, row);
    return row;
  }
}

async function reconcile(ctx: MutationCtx, person: Doc<"members">, groupRows: GroupRows, recordedAt?: number) {
  const counting = person.kind === "member" ? await groupRows.countingOf(person.user) : [];
  const groups = counting.map(({ row }) => row._id);
  const row = await memberGroupsOf(ctx, person._id);
  if (row === null && groups.length === 0) return;
  const from = row?.primary ?? null;
  const primary = from !== null && groups.includes(from) ? from : smallestOf(counting.map(({ row }) => row));
  if (row === null) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, groups, primary });
  else if (!sameGroups(row.groups, groups) || primary !== from) await ctx.db.patch(row._id, { groups, primary });
  if (primary === from) return;
  const at = await changeRecordedAt(groupRows, row?.groups ?? [], counting, recordedAt);
  await recordChange(ctx, person, from, primary, from === null ? "default" : "fallback", at);
}

async function changeRecordedAt(groupRows: GroupRows, before: GroupId[], counting: CountingGroup[], recordedAt: number | undefined): Promise<number> {
  const joined = counting.filter(({ row }) => !before.includes(row._id));
  const joinedAt = joined.map(({ joinedAt }) => joinedAt);
  if (recordedAt !== undefined) return Math.min(Date.now(), Math.max(recordedAt, ...joinedAt));
  const left = await groupRows.leftGroupsOf(before.filter((group) => !counting.some(({ row }) => row._id === group)));
  const changedAt = [...joined.map(({ row }) => row), ...left].flatMap((group) => (group?.changedAt === undefined ? [] : [group.changedAt]));
  return Math.min(Date.now(), changedAt.length === 0 ? Date.now() : Math.max(...changedAt));
}

function smallestOf(groups: Doc<"userGroups">[]): GroupId | null {
  const sizeOf = ({ members }: Doc<"userGroups">) => members ?? Number.POSITIVE_INFINITY;
  const bySize = (first: Doc<"userGroups">, second: Doc<"userGroups">) =>
    sizeOf(first) - sizeOf(second) || first.name.localeCompare(second.name) || first.group.localeCompare(second.group);
  return groups.toSorted(bySize)[0]?._id ?? null;
}

function sameGroups(first: GroupId[], second: GroupId[]) {
  return first.length === second.length && first.every((group) => second.includes(group));
}
