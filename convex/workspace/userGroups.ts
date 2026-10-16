import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { ReportableError } from "../analytics/exceptions";
import { reconcileLater } from "../groups/reconcile";
import { recordDepartures, recordKeepingChange } from "../groups/transitions";
import { followPeopleLater, requestCatchUp } from "../analytics/person";
import type { ChatUserId } from "../engine/messageEvent";
import { isOlder } from "./directory";

export const userGroupValidator = v.object({
  workspace: v.string(),
  group: v.string(),
  handle: v.string(),
  name: v.string(),
  enabled: v.boolean(),
  automatic: v.boolean(),
  members: v.optional(v.number()),
});

export type UserGroup = Infer<typeof userGroupValidator>;

export type MembersUserGroup = Pick<UserGroup, "group" | "handle" | "name">;

type GroupKey = Pick<UserGroup, "workspace" | "group">;

export const maxUserGroupsKept = 2_000;
const membershipsClearedPerRun = 4_000;

const listingScopeValidator = v.union(v.object({ kind: v.literal("every-group") }), v.object({ kind: v.literal("one-group"), workspace: v.string(), group: v.string() }));

type ListingScope = Infer<typeof listingScopeValidator>;

export function keepsMembers({ enabled, automatic }: Pick<UserGroup, "enabled" | "automatic">) {
  return enabled && !automatic;
}

export async function userGroupsOf(ctx: QueryCtx, workspace: string, user: ChatUserId): Promise<MembersUserGroup[]> {
  const memberships = await ctx.db
    .query("userGroupMembers")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .collect();
  const groups = await Promise.all(memberships.map(({ group }) => userGroupRow(ctx, { workspace, group })));
  return groups
    .flatMap((row) => (row !== null && keepsMembers(row) ? [{ group: row.group, handle: row.handle, name: row.name }] : []))
    .toSorted((first, second) => first.handle.localeCompare(second.handle));
}

export async function userGroupsOfUser(ctx: QueryCtx, workspace: string, user: ChatUserId): Promise<string[]> {
  return (await userGroupMembershipsOf(ctx, workspace, user)).map(({ group }) => group);
}

export function userGroupMembershipsOf(ctx: QueryCtx, workspace: string, user: ChatUserId): Promise<Doc<"userGroupMembers">[]> {
  return ctx.db
    .query("userGroupMembers")
    .withIndex("by_user", (q) => q.eq("workspace", workspace).eq("user", user))
    .collect();
}

export async function userGroupHandleOf(ctx: QueryCtx, workspace: string, group: string): Promise<string | undefined> {
  return (await userGroupRow(ctx, { workspace, group }))?.handle;
}

export async function keptUserGroupHandlesIn(ctx: QueryCtx, workspace: string): Promise<Map<string, string>> {
  const rows = await ctx.db
    .query("userGroups")
    .withIndex("by_group", (q) => q.eq("workspace", workspace))
    .collect();
  return new Map(rows.filter(keepsMembers).map(({ group, handle }) => [group, handle]));
}

export const keepUserGroups = internalMutation({
  args: { listed: v.array(userGroupValidator), scope: listingScopeValidator, asOf: v.number() },
  handler: async (ctx, { listed, scope, asOf }) => {
    const stored = await ctx.db.query("userGroups").take(maxUserGroupsKept + 1);
    const storedKeys = new Set(stored.map(keyOf));
    const unknown = listed.filter((group) => !storedKeys.has(keyOf(group)));
    if (stored.length + unknown.length > maxUserGroupsKept) throw new ReportableError("Slack listed more user groups than the directory keeps");
    const gone = unlistedIn(stored, scope, listed).map((group) => ({ ...group, enabled: false }));
    const changes = [];
    for (const group of [...listed, ...gone]) changes.push(await keepUserGroup(ctx, group, asOf));
    if (changes.includes("stopped-keeping-members")) await ctx.scheduler.runAfter(0, internal.workspace.userGroups.clearUnkeptMemberships, {});
    if (changes.includes("renamed")) await requestCatchUp(ctx);
  },
});

export const clearUnkeptMemberships = internalMutation({
  args: {},
  handler: async (ctx) => {
    let left = membershipsClearedPerRun;
    const cleared: Doc<"userGroupMembers">[] = [];
    const clearedAt = Date.now();
    for (const row of await ctx.db.query("userGroups").collect()) {
      if (keepsMembers(row)) continue;
      const memberships = await membershipsOf(ctx, row).take(left);
      for (const membership of memberships) await ctx.db.delete(membership._id);
      await recordDepartures(ctx, row, memberships, clearedAt);
      cleared.push(...memberships);
      left -= memberships.length;
      if (left === 0) {
        await ctx.scheduler.runAfter(0, internal.workspace.userGroups.clearUnkeptMemberships, {});
        break;
      }
    }
    await followPeopleWhoLeftGroups(ctx, cleared);
    await reconcileMembershipsLater(ctx, cleared);
  },
});

export const keepUserGroupMembers = internalMutation({
  args: { workspace: v.string(), group: v.string(), users: v.array(v.string()), asOf: v.number() },
  handler: async (ctx, { users, asOf, ...key }) => {
    const row = await userGroupRow(ctx, key);
    if (row === null || !keepsMembers(row) || isOlder(asOf, row.membersAsOf)) return;
    const changed = await replaceMembers(ctx, row, users);
    await followPeopleLater(ctx, key.workspace, changed);
    const count = isOlder(asOf, row.membersCountAsOf) ? {} : { members: users.length, membersCountAsOf: asOf };
    await ctx.db.patch(row._id, { membersAsOf: asOf, ...count });
    await reconcileLater(ctx, key.workspace, [...new Set([...changed, ...users])]);
  },
});

type UserGroupChange = "unchanged" | "stopped-keeping-members" | "renamed";

async function followPeopleWhoLeftGroups(ctx: MutationCtx, memberships: Doc<"userGroupMembers">[]) {
  for (const [workspace, users] of usersByWorkspaceOf(memberships)) await followPeopleLater(ctx, workspace, users);
}

async function reconcileMembershipsLater(ctx: MutationCtx, memberships: Doc<"userGroupMembers">[]) {
  for (const [workspace, users] of usersByWorkspaceOf(memberships)) await reconcileLater(ctx, workspace, users);
}

function usersByWorkspaceOf(memberships: Doc<"userGroupMembers">[]): Map<string, ChatUserId[]> {
  const usersByWorkspace = new Map<string, Set<ChatUserId>>();
  for (const { workspace, user } of memberships) usersByWorkspace.set(workspace, (usersByWorkspace.get(workspace) ?? new Set()).add(user));
  return new Map([...usersByWorkspace].map(([workspace, users]) => [workspace, [...users]]));
}

async function keepUserGroup(ctx: MutationCtx, group: UserGroup, asOf: number): Promise<UserGroupChange> {
  const row = await userGroupRow(ctx, group);
  if (row !== null && isOlder(asOf, row.asOf)) return "unchanged";
  const { members, ...described } = group;
  const kept = { ...described, asOf, ...(!isOlder(asOf, row?.membersCountAsOf) && members !== undefined && { members, membersCountAsOf: asOf }) };
  if (row === null) {
    await ctx.db.insert("userGroups", kept);
    return "unchanged";
  }
  await ctx.db.patch(row._id, kept);
  if (keepsMembers(row) !== keepsMembers(group)) await recordKeepingChange(ctx, row, keepsMembers(group), Date.now());
  if (!keepsMembers(row)) return "unchanged";
  if (!keepsMembers(group)) return "stopped-keeping-members";
  return row.handle === group.handle ? "unchanged" : "renamed";
}

function unlistedIn(stored: Doc<"userGroups">[], scope: ListingScope, listed: UserGroup[]): UserGroup[] {
  const listedKeys = new Set(listed.map(keyOf));
  const inScope = (row: Doc<"userGroups">) => scope.kind === "every-group" || keyOf(row) === keyOf(scope);
  return stored.filter((row) => inScope(row) && !listedKeys.has(keyOf(row))).map(userGroupOf);
}

function keyOf({ workspace, group }: GroupKey) {
  return `${workspace}/${group}`;
}

function userGroupOf({ workspace, group, handle, name, enabled, automatic }: Doc<"userGroups">): UserGroup {
  return { workspace, group, handle, name, enabled, automatic };
}

async function replaceMembers(ctx: MutationCtx, row: Doc<"userGroups">, users: ChatUserId[]): Promise<ChatUserId[]> {
  const { workspace, group } = row;
  const wanted = new Set(users);
  const kept = await membershipsOf(ctx, row).collect();
  const removed = kept.filter((membership) => !wanted.delete(membership.user));
  for (const membership of removed) await ctx.db.delete(membership._id);
  await recordDepartures(ctx, row, removed, Date.now());
  for (const user of wanted) await ctx.db.insert("userGroupMembers", { workspace, group, user });
  return [...removed.map(({ user }) => user), ...wanted];
}

function membershipsOf(ctx: QueryCtx, { workspace, group }: GroupKey) {
  return ctx.db.query("userGroupMembers").withIndex("by_group", (q) => q.eq("workspace", workspace).eq("group", group));
}

export function userGroupRow(ctx: QueryCtx, { workspace, group }: GroupKey) {
  return ctx.db
    .query("userGroups")
    .withIndex("by_group", (q) => q.eq("workspace", workspace).eq("group", group))
    .unique();
}
