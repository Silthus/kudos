import type { QueryCtx } from "../_generated/server";
import type { ViewedBoard } from "../analytics/projections";
import { groupsBoardShownTo } from "./groupBoards";
import { myGroupBoardShownTo } from "./myGroupBoard";
import type { MemberId } from "../workspace/directory";

export async function boardsShownTo(ctx: QueryCtx, member: MemberId): Promise<ViewedBoard[]> {
  const groups: ViewedBoard[] = (await groupsBoardShownTo(ctx, member)) ? ["groups"] : [];
  const myGroup: ViewedBoard[] = (await myGroupBoardShownTo(ctx, member)) ? ["my-group"] : [];
  return ["everyone", ...groups, ...myGroup];
}
