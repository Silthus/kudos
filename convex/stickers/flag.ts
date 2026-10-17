import { exposed, memberDecision, type Flag } from "../analytics/flags";
import { teamPagesShownTo } from "../companyProfiles/flag";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const stickerBookFlag = { key: "sticker-book", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const teamSpiritFlag = { key: "team-spirit", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function stickersShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, stickerBookFlag, member);
}

export function teamSpiritShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, teamSpiritFlag, member);
}

export async function teamSpiritAppliesTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const applies = await memberDecision(ctx, teamSpiritFlag, member);
  await exposed(ctx, teamSpiritFlag, member, applies);
  return applies && (await stickersShownTo(ctx, member)) && (await teamPagesShownTo(ctx, member));
}
