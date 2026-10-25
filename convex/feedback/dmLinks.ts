import type { QueryCtx } from "../_generated/server";
import { websiteOriginFor } from "../website/link";
import type { MemberId } from "../workspace/directory";

export type DmLinks = { book: string; quests: string };

export async function dmLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<DmLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  if (origin === null) return null;
  return { book: `${origin}/book`, quests: `${origin}/book#me/quests` };
}
