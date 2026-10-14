import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { userGroupRow, userGroupsOfUser } from "../workspace/userGroups";
import { countsAsGroup, memberGroupsOf, type GroupId } from "./groups";
import { recordChange } from "./history";

const usersPerPage = 100;
const directoryRowsPerPage = 1_000;

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
    for (const person of people) if (wanted.has(person.user)) await reconcile(ctx, person, groups);
    const lastRead = people.at(-1)?.user;
    if (people.length === directoryRowsPerPage && lastRead !== undefined) await reconcileLater(ctx, workspace, sorted.filter((user) => user > lastRead));
  },
});

export async function reconcileUser(ctx: MutationCtx, workspace: string, user: ChatUserId) {
  const person = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, workspace));
}

export async function reconcileMember(ctx: MutationCtx, member: MemberId) {
  const person = await ctx.db.get(member);
  if (person !== null) await reconcile(ctx, person, new GroupRows(ctx, person.workspace));
}

class GroupRows {
  private readonly rows = new Map<string, Promise<Doc<"userGroups"> | null>>();

  constructor(
    private readonly ctx: MutationCtx,
    private readonly workspace: string,
  ) {}

  async countingOf(user: ChatUserId): Promise<Doc<"userGroups">[]> {
    const groups = await Promise.all((await userGroupsOfUser(this.ctx, this.workspace, user)).map((group) => this.rowOf(group)));
    return groups.filter((row): row is Doc<"userGroups"> => row !== null && countsAsGroup(row));
  }

  private rowOf(group: string) {
    const row = this.rows.get(group) ?? userGroupRow(this.ctx, { workspace: this.workspace, group });
    this.rows.set(group, row);
    return row;
  }
}

async function reconcile(ctx: MutationCtx, person: Doc<"members">, groupRows: GroupRows) {
  const counting = person.kind === "member" ? await groupRows.countingOf(person.user) : [];
  const groups = counting.map(({ _id }) => _id);
  const row = await memberGroupsOf(ctx, person._id);
  if (row === null && groups.length === 0) return;
  const from = row?.primary ?? null;
  const primary = from !== null && groups.includes(from) ? from : smallestOf(counting);
  if (row === null) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, groups, primary });
  else if (!sameGroups(row.groups, groups) || primary !== from) await ctx.db.patch(row._id, { groups, primary });
  if (primary !== from) await recordChange(ctx, person, from, primary, from === null ? "default" : "fallback");
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
