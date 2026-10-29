import type { QueryCtx } from "../_generated/server";
import { websiteOriginFor } from "../website/link";
import { linkFrom, type VisitSource } from "../website/visitSource";
import type { MemberId } from "../workspace/directory";

export type DmLinks = { book: string; quests: string };

export type ReplyLinks = DmLinks & { home: string };

export async function dmLinksFor(ctx: QueryCtx, workspace: string, member: MemberId, source: VisitSource): Promise<DmLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  return origin === null ? null : dmLinksAt(origin, source);
}

export async function replyLinksFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<ReplyLinks | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  return origin === null ? null : { home: linkFrom("reply", `${origin}/`), ...dmLinksAt(origin, "reply") };
}

function dmLinksAt(origin: string, source: VisitSource): DmLinks {
  return { book: linkFrom(source, `${origin}/book`), quests: linkFrom(source, `${origin}/book#me/quests`) };
}
