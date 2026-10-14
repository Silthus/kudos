import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { userGroupRowsOf } from "../workspace/userGroups";
import { countsAsGroup, memberGroupsOf, type GroupId } from "./groups";
import { recordChange } from "./history";

const usersPerPage = 100;

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
    const wanted = new Set(users);
    const known = ctx.db.query("members").withIndex("by_user", (q) => q.eq("workspace", workspace).gte("user", first).lte("user", last));
    for await (const person of known) if (wanted.has(person.user)) await reconcile(ctx, person);
  },
});

export async function reconcileUser(ctx: MutationCtx, workspace: string, user: ChatUserId) {
  const person = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .unique();
  if (person !== null) await reconcile(ctx, person);
}

export async function reconcileMember(ctx: MutationCtx, member: MemberId) {
  const person = await ctx.db.get(member);
  if (person !== null) await reconcile(ctx, person);
}

async function reconcile(ctx: MutationCtx, person: Doc<"members">) {
  const counting = person.kind === "member" ? (await userGroupRowsOf(ctx, person.workspace, person.user)).filter(countsAsGroup) : [];
  const groups = counting.map(({ _id }) => _id);
  const row = await memberGroupsOf(ctx, person._id);
  if (row === null && groups.length === 0) return;
  const before = row?.groups ?? [];
  const sizes = await resized(ctx, person.workspace, before, groups);
  const from = row?.primary ?? null;
  const primary = from !== null && groups.includes(from) ? from : smallestOf(counting, sizes);
  if (row === null) await ctx.db.insert("memberGroups", { workspace: person.workspace, member: person._id, groups, primary });
  else if (!sameGroups(before, groups) || primary !== from) await ctx.db.patch(row._id, { groups, primary });
  if (primary !== from) await recordChange(ctx, person, from, primary, from === null ? "default" : "fallback");
}

async function resized(ctx: MutationCtx, workspace: string, before: GroupId[], after: GroupId[]): Promise<Map<GroupId, number>> {
  const sizes = new Map<GroupId, number>();
  for (const group of new Set([...before, ...after])) {
    const change = Number(after.includes(group)) - Number(before.includes(group));
    const row = await ctx.db
      .query("groupSizes")
      .withIndex("by_group", (q) => q.eq("group", group))
      .unique();
    const members = (row?.members ?? 0) + change;
    if (row === null) await ctx.db.insert("groupSizes", { workspace, group, members });
    else if (change !== 0) await ctx.db.patch(row._id, { members });
    sizes.set(group, members);
  }
  return sizes;
}

function smallestOf(groups: Doc<"userGroups">[], sizes: Map<GroupId, number>): GroupId | null {
  const bySize = (first: Doc<"userGroups">, second: Doc<"userGroups">) =>
    (sizes.get(first._id) ?? 0) - (sizes.get(second._id) ?? 0) || first.name.localeCompare(second.name) || first.group.localeCompare(second.group);
  return groups.toSorted(bySize)[0]?._id ?? null;
}

function sameGroups(first: GroupId[], second: GroupId[]) {
  return first.length === second.length && first.every((group) => second.includes(group));
}
