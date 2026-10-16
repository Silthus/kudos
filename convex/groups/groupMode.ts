import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { keepsMembers } from "../workspace/userGroups";
import { groupsApplyTo } from "./flag";
import { countsAsGroup, groupModeOf, groupSettingsRow, userGroupsIn, type GroupId, type GroupMode, type GroupRef } from "./groups";
import type { GroupModeKind } from "./mode";
import { reconcileEveryMemberLater } from "./reconcile";
import { recordCountingChange } from "./transitions";

export type GroupModeChange = { mode: GroupModeKind; allowlist?: string[] };

export type GroupModeFacts = { mode: GroupModeKind; groups: GroupRef[]; allowlist: GroupId[] };

type Admin = { member: MemberId; admin: boolean };

export async function groupModeShownTo(ctx: MutationCtx, workspace: string, person: Admin): Promise<GroupModeFacts | null> {
  if (!(await setsGroupMode(ctx, person))) return null;
  const pickable = (await userGroupsIn(ctx, workspace).collect()).filter(keepsMembers);
  if (pickable.length === 0) return null;
  const { mode, allowlist = [] } = await groupModeOf(ctx, workspace);
  const groups = pickable.map(({ _id, name }) => ({ group: _id, name })).toSorted((first, second) => first.name.localeCompare(second.name));
  return { mode, groups, allowlist };
}

export async function setGroupMode(ctx: MutationCtx, workspace: string, person: Admin, change: GroupModeChange): Promise<boolean> {
  if (!(await setsGroupMode(ctx, person))) return false;
  const groups = await userGroupsIn(ctx, workspace).collect();
  const before = await groupModeOf(ctx, workspace);
  const after = { mode: change.mode, allowlist: allowlistOf(groups, before, change) };
  await saveGroupMode(ctx, workspace, after);
  const flipped = groups.filter((row) => countsAsGroup(row, before) !== countsAsGroup(row, after));
  const changedAt = Date.now();
  for (const row of flipped) await recordCountingChange(ctx, row, countsAsGroup(row, after), changedAt);
  if (flipped.length > 0) await reconcileEveryMemberLater(ctx, workspace);
  return true;
}

async function setsGroupMode(ctx: MutationCtx, { member, admin }: Admin) {
  return admin && (await groupsApplyTo(ctx, member));
}

function allowlistOf(groups: Doc<"userGroups">[], before: GroupMode, { mode, allowlist }: GroupModeChange): GroupId[] | undefined {
  if (allowlist !== undefined) {
    const picked = new Set(allowlist);
    return groups.filter(({ _id }) => picked.has(_id)).map(({ _id }) => _id);
  }
  if (mode === "allowlist" && before.allowlist === undefined) return groups.filter(keepsMembers).map(({ _id }) => _id);
  return before.allowlist;
}

async function saveGroupMode(ctx: MutationCtx, workspace: string, { mode, allowlist }: GroupMode) {
  const row = await groupSettingsRow(ctx, workspace);
  if (row === null) await ctx.db.insert("groupSettings", { workspace, mode, allowlist });
  else await ctx.db.patch(row._id, { mode, allowlist });
}
