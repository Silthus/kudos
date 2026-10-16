import { memberDecision, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const bookSpreadFlag = { key: "book-spread", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type BookSpreadShown = { bookSpread?: true };

export async function bookSpreadShownTo(ctx: QueryCtx, member: MemberId): Promise<BookSpreadShown> {
  return (await memberDecision(ctx, bookSpreadFlag, member)) ? { bookSpread: true } : {};
}
