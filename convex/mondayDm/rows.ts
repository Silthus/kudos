import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";

export type MondayDmRow = Doc<"mondayDms">;

export async function hasMondayDm(ctx: QueryCtx, member: MemberId, monday: DayKey): Promise<boolean> {
  return (await mondayDmOf(ctx, member, monday)) !== null;
}

export function mondayDmOf(ctx: QueryCtx, member: MemberId, monday: DayKey): Promise<MondayDmRow | null> {
  return ctx.db
    .query("mondayDms")
    .withIndex("by_member_monday", (q) => q.eq("member", member).eq("monday", monday))
    .unique();
}
