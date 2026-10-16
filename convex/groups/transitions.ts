import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ChatUserId } from "../engine/messageEvent";
import { groupModeOf, isAllowed, type GroupId, type GroupMode } from "./groups";

export type CountingChange = Pick<Doc<"groupCountingChanges">, "counts" | "at">;

type LoggedGroup = Pick<Doc<"userGroups">, "_id" | "workspace">;

export function joinedAtOf({ _creationTime }: Doc<"userGroupMembers">): number {
  return Math.floor(_creationTime);
}

export async function recordDepartures(ctx: MutationCtx, group: Doc<"userGroups">, memberships: Doc<"userGroupMembers">[], at: number) {
  for (const membership of memberships) {
    await ctx.db.insert("userGroupDepartures", { workspace: group.workspace, user: membership.user, group: group._id, joinedAt: joinedAtOf(membership), at });
  }
}

export function departuresSince(ctx: QueryCtx, workspace: string, user: ChatUserId, since: number) {
  return ctx.db
    .query("userGroupDepartures")
    .withIndex("by_user_at", (q) => q.eq("workspace", workspace).eq("user", user).gte("at", since))
    .collect();
}

export class KeepingChanges {
  private readonly modes = new Map<string, Promise<GroupMode>>();

  constructor(private readonly ctx: MutationCtx) {}

  async record(group: LoggedGroup, keepsMembers: boolean, at: number) {
    const mode = this.modes.get(group.workspace) ?? groupModeOf(this.ctx, group.workspace);
    this.modes.set(group.workspace, mode);
    if (isAllowed(group, await mode)) await recordCountingChange(this.ctx, group, keepsMembers, at);
  }
}

export async function recordCountingChange(ctx: MutationCtx, group: LoggedGroup, counts: boolean, at: number) {
  await ctx.db.insert("groupCountingChanges", { workspace: group.workspace, group: group._id, counts, at });
}

export function countingChangesOf(ctx: QueryCtx, group: GroupId): Promise<CountingChange[]> {
  return ctx.db
    .query("groupCountingChanges")
    .withIndex("by_group_at", (q) => q.eq("group", group))
    .collect();
}
