import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ReportableError } from "../analytics/exceptions";
import { memberDecision } from "../analytics/flags";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { keepsMembers } from "../workspace/userGroups";
import { groupsFlag } from "./flag";

export type GroupId = Id<"userGroups">;

export type GroupRef = { group: GroupId; name: string };

export function countsAsGroup(row: Doc<"userGroups">): boolean {
  return keepsMembers(row);
}

export async function availableIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  for await (const row of ctx.db.query("userGroups").withIndex("by_group", (q) => q.eq("workspace", workspace))) {
    if (countsAsGroup(row)) return true;
  }
  return false;
}

export async function groupsShownTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, groupsFlag, member)) && (await availableIn(ctx, (await chatUserOf(ctx, member)).workspace));
}

export async function primaryGroupOf(ctx: QueryCtx, member: MemberId): Promise<GroupRef | null> {
  const primary = (await memberGroupsOf(ctx, member))?.primary ?? null;
  return primary === null ? null : groupRefOf(ctx, primary);
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
