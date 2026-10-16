import { memberDecision, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const stickerBookFlag = { key: "sticker-book", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function stickersShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, stickerBookFlag, member);
}
