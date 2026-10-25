import type { QueryCtx } from "../_generated/server";
import { websiteOrigin } from "../website/link";

export type DmLinks = { book: string; quests: string };

export async function dmLinksOf(ctx: QueryCtx, workspace: string): Promise<DmLinks | null> {
  const origin = await websiteOrigin(ctx, workspace);
  return origin === null ? null : { book: `${origin}/book`, quests: `${origin}/book#me` };
}
