import type { QueryCtx } from "../_generated/server";
import { teamSpiritShownTo } from "../stickers/flag";
import type { MemberId } from "../workspace/directory";
import { ladders, type LadderId } from "./ladders";

export async function laddersShownTo(ctx: QueryCtx, viewer: MemberId | null): Promise<LadderId[]> {
  const teamSpiritShown = viewer !== null && (await teamSpiritShownTo(ctx, viewer));
  return ladders.ladders.map(({ ladder }) => ladder).filter((ladder) => ladder !== "team-spirit" || teamSpiritShown);
}
