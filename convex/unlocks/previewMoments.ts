import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type PreviewedMoment = Doc<"previewMoments">["moment"];

export function previewMomentOf(ctx: QueryCtx, member: MemberId, moment: PreviewedMoment) {
  return ctx.db
    .query("previewMoments")
    .withIndex("by_member_moment", (q) => q.eq("member", member).eq("moment", moment))
    .unique();
}
