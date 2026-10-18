import { memberDecision, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const albumFlag = { key: "album", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function albumShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, albumFlag, member);
}

export type AlbumShown = { album?: true };

export async function albumOnProfileOf(ctx: QueryCtx, member: MemberId): Promise<AlbumShown> {
  return (await albumShownTo(ctx, member)) ? { album: true } : {};
}
