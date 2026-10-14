import type { QueryCtx } from "../_generated/server";
import type { ViewedBoard } from "../analytics/projections";
import { groupsBoardShownTo } from "./groupBoards";
import type { MemberId } from "../workspace/directory";

export async function boardsShownTo(ctx: QueryCtx, member: MemberId): Promise<ViewedBoard[]> {
  return (await groupsBoardShownTo(ctx, member)) ? ["everyone", "groups"] : ["everyone"];
}
