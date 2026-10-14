import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";
import type { PrimaryGroupCause } from "./cause";
import type { GroupId } from "./groups";

export async function primaryGroupAt(ctx: QueryCtx, member: MemberId, at: number): Promise<GroupId | null> {
  const entry = await ctx.db
    .query("primaryGroupHistory")
    .withIndex("by_member_at", (q) => q.eq("member", member).lte("at", at))
    .order("desc")
    .first();
  return entry?.group ?? null;
}

function latestEntryOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("primaryGroupHistory")
    .withIndex("by_member_at", (q) => q.eq("member", member))
    .order("desc")
    .first();
}

export async function recordChange(ctx: MutationCtx, person: Doc<"members">, from: GroupId | null, to: GroupId | null, cause: PrimaryGroupCause, recordedAt: number) {
  const at = Math.max(recordedAt, (await latestEntryOf(ctx, person._id))?.at ?? recordedAt);
  const change = { workspace: person.workspace, member: person._id, from, cause, at };
  await ctx.db.insert("primaryGroupHistory", { ...change, group: to });
  await publish(ctx, { type: "primaryGroupChanged", ...change, to });
}
