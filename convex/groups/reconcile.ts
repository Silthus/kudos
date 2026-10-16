import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { userGroupMembershipsOf, userGroupRow } from "../workspace/userGroups";
import { countsAsGroup, groupModeOf, memberGroupsOf, type GroupId, type GroupMode } from "./groups";
import { latestEntryOf, recordChange } from "./history";
import { countingChangesOf, departuresSince, joinedAtOf, type CountingChange } from "./transitions";

const usersPerPage = 100;
const directoryRowsPerPage = 1_000;
const membershipsPerPage = 8_000;

export async function reconcileLater(ctx: MutationCtx, workspace: string, users: ChatUserId[]) {
  const sorted = users.toSorted();
  for (let start = 0; start < sorted.length; start += usersPerPage) {
    await ctx.scheduler.runAfter(0, internal.groups.reconcile.reconcileUsers, { workspace, users: sorted.slice(start, start + usersPerPage) });
  }
}

export const reconcileUsers = internalMutation({
  args: { workspace: v.string(), users: v.array(v.string()) },
  handler: async (ctx, { workspace, users }) => {
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
      if (groups.membershipsRead >= membershipsPerPage) return reconcileLater(ctx, workspace, sorted.filter((user) => user >= person.user));
      await reconcile(ctx, person, groups);
    }
    const lastRead = people.at(-1)?.user;
    if (people.length === directoryRowsPerPage && lastRead !== undefined) await reconcileLater(ctx, workspace, sorted.filter((user) => user > lastRead));
  },
});

export async function reconcileEveryMemberLater(ctx: MutationCtx, workspace: string) {
  await ctx.scheduler.runAfter(0, internal.groups.reconcile.reconcileWorkspace, { workspace });
}

export const reconcileWorkspace = internalMutation({
  args: { workspace: v.string(), after: v.optional(v.string()) },
  handler: async (ctx, { workspace, after }) => {
    const people = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => (after === undefined ? q.eq("workspace", workspace) : q.eq("workspace", workspace).gt("user", after)))
      .take(usersPerPage);
    const groups = new GroupRows(ctx, workspace);
    let reconciled = after;
    for (const person of people) {
      if (groups.membershipsRead >= membershipsPerPage) break;
      await reconcile(ctx, person, groups);
      reconciled = person.user;
    }
    const lastRead = people.at(-1)?.user;
    if (lastRead === undefined) return;
    if (people.length === usersPerPage || reconciled !== lastRead) await ctx.scheduler.runAfter(0, internal.groups.reconcile.reconcileWorkspace, { workspace, after: reconciled });
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

export async function reconcilePageOf(ctx: MutationCtx, members: MemberId[]): Promise<MemberId[]> {
  const groups = new Map<string, GroupRows>();
  for (const [index, member] of members.entries()) {
    const person = await ctx.db.get(member);
    if (person === null) continue;
    const rows = groups.get(person.workspace) ?? new GroupRows(ctx, person.workspace);
    groups.set(person.workspace, rows);
    if (index >= usersPerPage || rows.membershipsRead >= membershipsPerPage) return members.slice(index);
    await reconcile(ctx, person, rows);
  }
  return [];
}

type Membership = { row: Doc<"userGroups">; joinedAt: number; leftAt?: number };

class GroupRows {
  private readonly rows = new Map<string, Promise<Doc<"userGroups"> | null>>();
  private readonly rowsById = new Map<GroupId, Promise<Doc<"userGroups"> | null>>();
  private readonly countingChanges = new Map<GroupId, Promise<CountingChange[]>>();
  private mode: Promise<GroupMode> | undefined;
  membershipsRead = 0;

  constructor(
    private readonly ctx: MutationCtx,
    private readonly workspace: string,
  ) {}

  async timelineOf(user: ChatUserId, since: number): Promise<Timeline> {
    const [current, departed] = await Promise.all([userGroupMembershipsOf(this.ctx, this.workspace, user), departuresSince(this.ctx, this.workspace, user, since)]);
    this.membershipsRead += current.length + departed.length;
    const memberships = await Promise.all([
      ...current.map(async (membership) => ({ row: await this.rowOf(membership.group), joinedAt: joinedAtOf(membership) })),
      ...departed.map(async ({ group, joinedAt, at }) => ({ row: await this.rowById(group), joinedAt, leftAt: at })),
    ]);
    const known = memberships.filter((membership): membership is Membership => membership.row !== null);
    const groups = [...new Set(known.map(({ row }) => row._id))];
    const changes = new Map(await Promise.all(groups.map(async (group) => [group, await this.countingChangesOf(group)] as const)));
    return new Timeline(known, changes, await this.modeOf());
  }

  private modeOf() {
    this.mode ??= groupModeOf(this.ctx, this.workspace);
    return this.mode;
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

  private countingChangesOf(group: GroupId) {
    const known = this.countingChanges.get(group);
    if (known !== undefined) return known;
    const changes = countingChangesOf(this.ctx, group).then((read) => {
      this.membershipsRead += read.length;
      return read;
    });
    this.countingChanges.set(group, changes);
    return changes;
  }
}

class Timeline {
  constructor(
    private readonly memberships: Membership[],
    private readonly changes: ReadonlyMap<GroupId, CountingChange[]>,
    private readonly mode: GroupMode,
  ) {}

  instantsBetween(since: number, until: number): number[] {
    const instants = this.memberships.flatMap(({ row, joinedAt, leftAt }) => [joinedAt, ...(leftAt === undefined ? [] : [leftAt]), ...this.changesOf(row).map(({ at }) => at)]);
    return [...new Set(instants.filter((at) => at >= since && at <= until))].toSorted((first, second) => first - second);
  }

  countingAt(at: number): Doc<"userGroups">[] {
    return this.memberships.filter(({ row, joinedAt, leftAt = Number.POSITIVE_INFINITY }) => joinedAt <= at && at < leftAt && this.countsAt(row, at)).map(({ row }) => row);
  }

  countingNow(): Doc<"userGroups">[] {
    return this.memberships.filter(({ row, leftAt }) => leftAt === undefined && countsAsGroup(row, this.mode)).map(({ row }) => row);
  }

  private countsAt(row: Doc<"userGroups">, at: number): boolean {
    const changes = this.changesOf(row);
    const inForce = changes.findLast((change) => change.at <= at);
    if (inForce !== undefined) return inForce.counts;
    const next = changes.find((change) => change.at > at);
    return next === undefined ? countsAsGroup(row, this.mode) : !next.counts;
  }

  private changesOf(row: Doc<"userGroups">): CountingChange[] {
    return this.changes.get(row._id) ?? [];
  }
}

async function reconcile(ctx: MutationCtx, person: Doc<"members">, groupRows: GroupRows, recordedAt?: number) {
  const row = await memberGroupsOf(ctx, person._id);
  const since = (await latestEntryOf(ctx, person._id))?.at ?? person._creationTime;
  const timeline = await groupRows.timelineOf(person.user, since);
  const isMember = person.kind === "member";
  const replayedUntil = isMember ? Date.now() : (recordedAt ?? since);
  let primary = row?.primary ?? null;
  for (const at of timeline.instantsBetween(since, replayedUntil)) primary = await moveTo(ctx, person, primary, timeline.countingAt(at), at);
  const counting = isMember ? timeline.countingNow() : [];
  primary = await moveTo(ctx, person, primary, counting, recordedAt ?? Date.now());
  const groups = [...new Set(counting.map(({ _id }) => _id))];
  if (row === null && groups.length === 0 && primary === null) return;
  if (row === null) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, groups, primary });
  else if (!sameGroups(row.groups, groups) || primary !== row.primary) await ctx.db.patch(row._id, { groups, primary });
}

async function moveTo(ctx: MutationCtx, person: Doc<"members">, primary: GroupId | null, counting: Doc<"userGroups">[], at: number): Promise<GroupId | null> {
  const next = primary !== null && counting.some(({ _id }) => _id === primary) ? primary : smallestOf(counting);
  if (next !== primary) await recordChange(ctx, person, primary, next, primary === null ? "default" : "fallback", at);
  return next;
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
