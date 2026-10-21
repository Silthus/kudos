import type { MutationCtx, QueryCtx } from "../_generated/server";
import { allowanceDay } from "../engine/allowance";
import { teasersShownTo } from "../items/flag";
import { keyOf, type PeriodKey } from "../leaderboard/periods";
import type { MemberId } from "../workspace/directory";

export const fewestThoughtfulGiversShown = 3;

export type NormViewer = { workspace: string; member: MemberId; timeZone: string | undefined };

export async function countThoughtfulGiver(ctx: MutationCtx, workspace: string, week: PeriodKey) {
  const counted = await countOf(ctx, workspace, week);
  if (counted === null) await ctx.db.insert("thoughtfulGiverCounts", { workspace, week, givers: 1 });
  else await ctx.db.patch(counted._id, { givers: counted.givers + 1 });
}

export async function thoughtfulGiversShownTo(ctx: QueryCtx, viewer: NormViewer): Promise<number | null> {
  if (!(await teasersShownTo(ctx, viewer.member))) return null;
  const givers = (await countOf(ctx, viewer.workspace, keyOf("week", allowanceDay(Date.now(), viewer.timeZone))))?.givers ?? 0;
  return givers < fewestThoughtfulGiversShown ? null : givers;
}

function countOf(ctx: QueryCtx, workspace: string, week: PeriodKey) {
  return ctx.db
    .query("thoughtfulGiverCounts")
    .withIndex("by_workspace_week", (q) => q.eq("workspace", workspace).eq("week", week))
    .unique();
}
