import { v, type Infer } from "convex/values";
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

const copyCauseValidator = v.object({ at: v.number(), groups: v.array(v.string()) });

type CopyCause = Infer<typeof copyCauseValidator>;

type Cause = CopyCause | { at: number; groups: "every-group" };

export async function reconcileLater(ctx: MutationCtx, workspace: string, users: ChatUserId[], cause?: CopyCause) {
  const sorted = users.toSorted();
  for (let start = 0; start < sorted.length; start += usersPerPage) {
    await ctx.scheduler.runAfter(0, internal.groups.reconcile.reconcileUsers, { workspace, users: sorted.slice(start, start + usersPerPage), cause });
  }
}

export const reconcileUsers = internalMutation({
  args: { workspace: v.string(), users: v.array(v.string()), cause: v.optional(copyCauseValidator) },
  handler: async (ctx, { workspace, users, cause }) => {
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
      if (groups.membershipsRead >= membershipsPerPage) return reconcileLater(ctx, workspace, sorted.filter((user) => user >= person.user), cause);
      await reconcile(ctx, person, groups, cause);
    }
    const lastRead = people.at(-1)?.user;
    if (people.length === directoryRowsPerPage && lastRead !== undefined) await reconcileLater(ctx, workspace, sorted.filter((user) => user > lastRead), cause);
  },
});

export async function reconcileUser(ctx: MutationCtx, workspace: string, user: ChatUserId, recordedAt?: number) {
  const cause = everyGroupAt(recordedAt);
  const person = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, workspace), cause);
}

export async function reconcileMember(ctx: MutationCtx, member: MemberId, recordedAt?: number) {
  const cause = everyGroupAt(recordedAt);
  const person = await ctx.db.get(member);
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, person.workspace), cause);
}

export async function reconcileFirstPageOf(ctx: MutationCtx, members: MemberId[]) {
  const people = (await Promise.all(members.slice(0, usersPerPage).map((member) => ctx.db.get(member)))).filter((person) => person !== null);
  const groups = new Map<string, GroupRows>();
  for (const person of people) {
    const rows = groups.get(person.workspace) ?? new GroupRows(ctx, person.workspace);
    groups.set(person.workspace, rows);
    if (rows.membershipsRead >= membershipsPerPage) return;
    await reconcile(ctx, person, rows);
  }
}

function everyGroupAt(recordedAt: number | undefined): Cause | undefined {
  return recordedAt === undefined ? undefined : { at: recordedAt, groups: "every-group" };
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

async function reconcile(ctx: MutationCtx, person: Doc<"members">, groupRows: GroupRows, cause?: Cause) {
  const counting = person.kind === "member" ? await groupRows.countingOf(person.user) : [];
  const groups = counting.map(({ row }) => row._id);
  const row = await memberGroupsOf(ctx, person._id);
  if (row === null && groups.length === 0) return;
  const from = row?.primary ?? null;
  const primary = from !== null && groups.includes(from) ? from : smallestOf(counting.map(({ row }) => row));
  if (row === null) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, groups, primary });
  else if (!sameGroups(row.groups, groups) || primary !== from) await ctx.db.patch(row._id, { groups, primary });
  if (primary === from) return;
  const joined = counting.filter(({ row: group }) => !(row?.groups ?? []).includes(group._id));
  const changedAt = from === null ? (cause?.at ?? latestChangeOf(joined.map(({ row }) => row))) : await departedAt(groupRows, from, cause);
  const primaryJoinedAt = joined.find(({ row }) => row._id === primary)?.joinedAt ?? changedAt;
  await recordChange(ctx, person, from, primary, from === null ? "default" : "fallback", Math.min(Date.now(), Math.max(changedAt, primaryJoinedAt)));
}

async function departedAt(groupRows: GroupRows, from: GroupId, cause: Cause | undefined): Promise<number> {
  const [left] = await groupRows.leftGroupsOf([from]);
  if (left === null || left === undefined) return cause?.at ?? Date.now();
  if (!countsAsGroup(left) && left.changedAt !== undefined) return left.changedAt;
  if (cause !== undefined && (cause.groups === "every-group" || cause.groups.includes(left.group))) return cause.at;
  return left.changedAt ?? cause?.at ?? Date.now();
}

function latestChangeOf(groups: Doc<"userGroups">[]): number {
  const changedAt = groups.flatMap(({ changedAt }) => (changedAt === undefined ? [] : [changedAt]));
  return changedAt.length === 0 ? Date.now() : Math.max(...changedAt);
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
