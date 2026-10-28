import type { QueryCtx } from "../_generated/server";
import { websiteOriginFor } from "../website/link";
import type { MemberId } from "../workspace/directory";

export type DmLinks = { book: string; quests: string };

export type ReplyLinks = DmLinks & { home: string };

export async function dmLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<DmLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  return origin === null ? null : dmLinksAt(origin);
}

export async function replyLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<ReplyLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  return origin === null ? null : { home: `${origin}/`, ...dmLinksAt(origin) };
}

function dmLinksAt(origin: string): DmLinks {
  return { book: `${origin}/book`, quests: `${origin}/book#me/quests` };
}
