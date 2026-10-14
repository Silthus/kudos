import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ReportableError } from "../analytics/exceptions";
import { memberDecision } from "../analytics/flags";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { keepsMembers } from "../workspace/userGroups";
import { groupsApplyTo, groupsFlag } from "./flag";
import type { GroupModeKind } from "./mode";

export type GroupId = Id<"userGroups">;

export type GroupRef = { group: GroupId; name: string };

export type GroupMode = { mode: GroupModeKind; allowlist?: GroupId[] };

const everyGroup: GroupMode = { mode: "all" };

export function countsAsGroup(row: Doc<"userGroups">, mode: GroupMode): boolean {
  return keepsMembers(row) && isAllowed(row, mode);
}

export function isAllowed(row: Doc<"userGroups">, { mode, allowlist = [] }: GroupMode): boolean {
  return mode === "all" || allowlist.includes(row._id);
}

export async function groupModeOf(ctx: QueryCtx, workspace: string): Promise<GroupMode> {
  const row = await groupSettingsRow(ctx, workspace);
  return row ?? everyGroup;
}

export function groupSettingsRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("groupSettings")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

export function userGroupsIn(ctx: QueryCtx, workspace: string) {
  return ctx.db.query("userGroups").withIndex("by_group", (q) => q.eq("workspace", workspace));
}

export async function availableIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  const mode = await groupModeOf(ctx, workspace);
  for await (const row of userGroupsIn(ctx, workspace)) {
    if (countsAsGroup(row, mode)) return true;
  }
  return false;
}

export async function groupsShownTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, groupsFlag, member)) && (await availableIn(ctx, (await chatUserOf(ctx, member)).workspace));
}

export async function isGroupsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await groupsApplyTo(ctx, member)) && (await availableIn(ctx, (await chatUserOf(ctx, member)).workspace));
}

export async function primaryGroupOf(ctx: QueryCtx, member: MemberId): Promise<GroupRef | null> {
  const primary = (await memberGroupsOf(ctx, member))?.primary ?? null;
  return primary === null ? null : groupRefOf(ctx, primary);
}

export async function countingPrimaryGroupOf(ctx: QueryCtx, member: MemberId): Promise<GroupRef | null> {
  const primary = (await memberGroupsOf(ctx, member))?.primary ?? null;
  const row = primary === null ? null : await ctx.db.get(primary);
  if (row === null || !countsAsGroup(row, await groupModeOf(ctx, row.workspace))) return null;
  return { group: row._id, name: row.name };
}

export async function countingGroupsOf(ctx: QueryCtx, member: MemberId): Promise<GroupRef[]> {
  const groups = (await memberGroupsOf(ctx, member))?.groups ?? [];
  const refs = await Promise.all(groups.map((group) => groupRefOf(ctx, group)));
  return refs.toSorted((first, second) => first.name.localeCompare(second.name));
}

export async function primaryMembersOf(ctx: QueryCtx, group: GroupId): Promise<MemberId[]> {
  const rows = await ctx.db
    .query("memberGroups")
    .withIndex("by_primary", (q) => q.eq("primary", group))
    .collect();
  return rows.map(({ member }) => member);
}

export function memberGroupsOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("memberGroups")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}

async function groupRefOf(ctx: QueryCtx, group: GroupId): Promise<GroupRef> {
  const row = await ctx.db.get(group);
  if (row === null) throw new ReportableError("a member's group is missing from the user group copy");
  return { group, name: row.name };
}
