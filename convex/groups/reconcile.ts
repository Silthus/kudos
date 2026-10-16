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
const indexRangesPerPage = 3_000;
const indexRangesPerPerson = 6;
const indexRangesPerHistoryWrite = 2;

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
      if (groups.exhausted()) return reconcileLater(ctx, workspace, sorted.filter((user) => user >= person.user));
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
      if (groups.exhausted()) break;
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
    if (index >= usersPerPage || rows.exhausted()) return members.slice(index);
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
  private documentsRead = 0;
  private indexRangesRead = 0;

  constructor(
    private readonly ctx: MutationCtx,
    private readonly workspace: string,
  ) {}

  countHistoryWrites(changes: number) {
    this.indexRangesRead += changes * indexRangesPerHistoryWrite;
  }

  exhausted(): boolean {
    return this.documentsRead >= membershipsPerPage || this.indexRangesRead >= indexRangesPerPage;
  }

  async timelineOf(user: ChatUserId, since: number, reconciled: GroupId[]): Promise<Timeline> {
    const [current, departed] = await Promise.all([userGroupMembershipsOf(this.ctx, this.workspace, user), departuresSince(this.ctx, this.workspace, user, since)]);
    this.documentsRead += current.length + departed.length;
    this.indexRangesRead += indexRangesPerPerson;
    const recorded = await Promise.all([
      ...current.map(async (membership) => ({ row: await this.rowOf(membership.group), joinedAt: joinedAtOf(membership) })),
      ...departed.map(async ({ group, joinedAt, at }) => ({ row: await this.rowById(group), joinedAt, leftAt: at })),
    ]);
    const unexplained = await this.unexplainedOf(reconciled, recorded);
    const known = [...recorded, ...unexplained].filter((membership): membership is Membership => membership.row !== null);
    const groups = [...new Set(known.map(({ row }) => row._id))];
    const changes = new Map(await Promise.all(groups.map(async (group) => [group, await this.countingChangesOf(group)] as const)));
    return new Timeline(known, changes, await this.modeOf());
  }

  private async unexplainedOf(reconciled: GroupId[], recorded: Array<{ row: Doc<"userGroups"> | null }>) {
    const explained = new Set(recorded.flatMap(({ row }) => (row === null ? [] : [row._id])));
    const missing = [...new Set(reconciled)].filter((group) => !explained.has(group));
    return Promise.all(missing.map(async (group) => ({ row: await this.rowById(group), joinedAt: Number.NEGATIVE_INFINITY, leftAt: Number.POSITIVE_INFINITY })));
  }

  private modeOf() {
    this.mode ??= groupModeOf(this.ctx, this.workspace);
    return this.mode;
  }

  private rowOf(group: string) {
    const row = this.rows.get(group) ?? this.readIndexRange(userGroupRow(this.ctx, { workspace: this.workspace, group }));
    this.rows.set(group, row);
    return row;
  }

  private rowById(group: GroupId) {
    const row = this.rowsById.get(group) ?? this.readIndexRange(this.ctx.db.get(group));
    this.rowsById.set(group, row);
    return row;
  }

  private readIndexRange<T>(read: Promise<T>): Promise<T> {
    this.indexRangesRead += 1;
    return read;
  }

  private countingChangesOf(group: GroupId) {
    const known = this.countingChanges.get(group);
    if (known !== undefined) return known;
    const changes = this.readIndexRange(countingChangesOf(this.ctx, group)).then((read) => {
      this.documentsRead += read.length;
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
  const since = Math.max((await latestEntryOf(ctx, person._id))?.at ?? person._creationTime, row?.directoryChangedAt ?? Number.NEGATIVE_INFINITY);
  const before = row?.primary ?? null;
  const timeline = await groupRows.timelineOf(person.user, since, before === null ? [] : [before]);
  const isMember = person.kind === "member";
  const memberUntil = memberUntilOf(isMember, recordedAt);
  const replayed = memberUntil === undefined ? [] : timeline.instantsBetween(since, memberUntil);
  const counting = isMember ? timeline.countingNow() : [];
  const steps = [...replayed.map((at) => ({ at, counting: timeline.countingAt(at) })), { at: recordedAt ?? Date.now(), counting }];
  let primary = before;
  let changes = 0;
  for (const step of steps) {
    const next = primaryAt(primary, step.counting);
    if (next === primary) continue;
    await recordChange(ctx, person, primary, next, primary === null ? "default" : "fallback", step.at);
    primary = next;
    changes += 1;
  }
  groupRows.countHistoryWrites(changes);
  await keepMemberGroups(ctx, person, row, { groups: [...new Set(counting.map(({ _id }) => _id))], primary, ...(recordedAt !== undefined && { directoryChangedAt: recordedAt }) });
}

type MemberGroups = Pick<Doc<"memberGroups">, "groups" | "primary" | "directoryChangedAt">;

async function keepMemberGroups(ctx: MutationCtx, person: Doc<"members">, row: Doc<"memberGroups"> | null, kept: MemberGroups) {
  if (row === null) {
    const fencesReplay = kept.directoryChangedAt !== undefined && kept.directoryChangedAt > person._creationTime;
    if (kept.groups.length > 0 || kept.primary !== null || fencesReplay) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, ...kept });
    return;
  }
  const unchanged = sameGroups(row.groups, kept.groups) && row.primary === kept.primary && kept.directoryChangedAt === undefined;
  if (!unchanged) await ctx.db.patch(row._id, kept);
}

function memberUntilOf(isMember: boolean, recordedAt: number | undefined): number | undefined {
  if (recordedAt !== undefined) return isMember ? undefined : recordedAt;
  return isMember ? Date.now() : undefined;
}

function primaryAt(primary: GroupId | null, counting: Doc<"userGroups">[]): GroupId | null {
  return primary !== null && counting.some(({ _id }) => _id === primary) ? primary : smallestOf(counting);
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
