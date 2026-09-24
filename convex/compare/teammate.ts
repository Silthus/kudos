import { ConvexError, v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { publicMember, requireViewer, type Viewer } from "../lib/access";
import { comparePeriodValidator } from "../lib/compare";
import { resolvePeriod } from "../lib/periods";
import { parseToday } from "../lib/time";

const UNAVAILABLE = "That teammate isn't available to compare.";

/**
 * The member to compare with: somebody else in the viewer's workspace who is a person and still
 * active. Ids come from the URL, so a malformed id, another table's id and a removed member all get
 * the same answer as an ineligible one.
 */
async function eligibleTeammate(ctx: QueryCtx, { member: me, workspace }: Viewer, memberId: string): Promise<Doc<"members">> {
  const id = ctx.db.normalizeId("members", memberId);
  const them = id ? await ctx.db.get(id) : null;
  if (!them || them.workspaceId !== workspace._id || them.isBot || them.deactivated || them._id === me._id) {
    throw new ConvexError(UNAVAILABLE);
  }
  return them;
}

/** Compare: you against one teammate over this period to date (the Teammate benchmark). */
export const get = query({
  args: {
    period: comparePeriodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
    /** From the URL (`?vs=<id>`), so validated here rather than by `v.id`. */
    memberId: v.string(),
  },
  handler: async (ctx, { period, today: todayArg, memberId }) => {
    const viewer = await requireViewer(ctx);
    const them = await eligibleTeammate(ctx, viewer, memberId);
    const p = resolvePeriod(period, parseToday(todayArg));
    return { mode: "teammate" as const, period, label: p.label, teammate: publicMember(them) };
  },
});
