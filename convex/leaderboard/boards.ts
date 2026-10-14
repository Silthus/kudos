import type { QueryCtx } from "../_generated/server";
import type { ViewedBoard } from "../analytics/projections";
import { groupsShownTo } from "../groups/groups";
import type { MemberId } from "../workspace/directory";

export async function boardsShownTo(ctx: QueryCtx, member: MemberId): Promise<ViewedBoard[]> {
  return (await groupsShownTo(ctx, member)) ? ["everyone", "groups"] : ["everyone"];
}
