import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { countingGroupsOf, memberGroupsOf, type GroupId, type GroupRef } from "./groups";
import { recordChange } from "./history";
import { reconcileMember } from "./reconcile";

export type PickOutcome = "picked" | "kept" | "refused";

export type GroupChoice = { primary: GroupRef; groups: GroupRef[] };

export async function pickPrimaryGroup(ctx: MutationCtx, member: MemberId, group: GroupId): Promise<PickOutcome> {
  await reconcileMember(ctx, member);
  const row = await memberGroupsOf(ctx, member);
  const person = await ctx.db.get(member);
  if (row === null || person === null || !row.groups.includes(group)) return "refused";
  if (row.primary === group) return "kept";
  await ctx.db.patch(row._id, { primary: group });
  await recordChange(ctx, person, row.primary, group, "picked", Date.now());
  return "picked";
}

export async function groupChoiceOf(ctx: QueryCtx, member: MemberId): Promise<GroupChoice | null> {
  const groups = await countingGroupsOf(ctx, member);
  const primaryId = (await memberGroupsOf(ctx, member))?.primary ?? null;
  const primary = groups.find(({ group }) => group === primaryId);
  return primary === undefined ? null : { primary, groups };
}
