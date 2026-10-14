import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";

export const userGroupValidator = v.object({
  workspace: v.string(),
  group: v.string(),
  handle: v.string(),
  name: v.string(),
  enabled: v.boolean(),
  automatic: v.boolean(),
});

export type UserGroup = Infer<typeof userGroupValidator>;

export type MembersUserGroup = Pick<UserGroup, "group" | "handle" | "name">;

type GroupKey = Pick<UserGroup, "workspace" | "group">;

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

export const keepUserGroups = internalMutation({
  args: { listed: v.array(userGroupValidator), scope: listingScopeValidator, asOf: v.number() },
  handler: async (ctx, { listed, scope, asOf }) => {
    for (const group of listed) await keepUserGroup(ctx, group, asOf);
    for (const gone of await unlistedIn(ctx, scope, listed)) await keepUserGroup(ctx, { ...gone, enabled: false }, asOf);
  },
});

export const keepUserGroupMembers = internalMutation({
  args: { workspace: v.string(), group: v.string(), users: v.array(v.string()), asOf: v.number() },
  handler: async (ctx, { users, asOf, ...key }) => {
    const row = await userGroupRow(ctx, key);
    if (row === null || !keepsMembers(row) || isOlder(asOf, row.membersAsOf)) return;
    await replaceMembers(ctx, key, users);
    await ctx.db.patch(row._id, { membersAsOf: asOf });
  },
});

async function keepUserGroup(ctx: MutationCtx, group: UserGroup, asOf: number) {
  const row = await userGroupRow(ctx, group);
  if (row !== null && isOlder(asOf, row.asOf)) return;
  const fields = { ...group, asOf, ...(!keepsMembers(group) && { membersAsOf: asOf }) };
  if (row === null) await ctx.db.insert("userGroups", fields);
  else await ctx.db.patch(row._id, fields);
  if (!keepsMembers(group)) await replaceMembers(ctx, group, []);
}

async function unlistedIn(ctx: QueryCtx, scope: ListingScope, listed: UserGroup[]): Promise<UserGroup[]> {
  const isListed = (key: GroupKey) => listed.some((group) => group.workspace === key.workspace && group.group === key.group);
  const inScope = scope.kind === "every-group" ? await ctx.db.query("userGroups").collect() : [await userGroupRow(ctx, scope)];
  return inScope.flatMap((row) => (row === null || isListed(row) ? [] : [userGroupOf(row)]));
}

function userGroupOf({ workspace, group, handle, name, enabled, automatic }: Doc<"userGroups">): UserGroup {
  return { workspace, group, handle, name, enabled, automatic };
}

async function replaceMembers(ctx: MutationCtx, { workspace, group }: GroupKey, users: ChatUserId[]) {
  const wanted = new Set(users);
  const kept = await ctx.db
    .query("userGroupMembers")
    .withIndex("by_group", (q) => q.eq("workspace", workspace).eq("group", group))
    .collect();
  for (const membership of kept) if (!wanted.delete(membership.user)) await ctx.db.delete(membership._id);
  for (const user of wanted) await ctx.db.insert("userGroupMembers", { workspace, group, user });
}

function userGroupRow(ctx: QueryCtx, { workspace, group }: GroupKey) {
  return ctx.db
    .query("userGroups")
    .withIndex("by_group", (q) => q.eq("workspace", workspace).eq("group", group))
    .unique();
}

function isOlder(asOf: number, known: number | undefined) {
  return known !== undefined && asOf < known;
}
