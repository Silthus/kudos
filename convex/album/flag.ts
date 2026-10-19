import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const albumFlag = { key: "album", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function albumShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, albumFlag, member);
}

export const randomEmojisFlag = { key: "random-emojis", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function randomEmojisShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, randomEmojisFlag, member);
}

export const emojiWizardFlag = { key: "emoji-wizard", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function emojiWizardShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, emojiWizardFlag, member);
}

export type AlbumShown = { album?: true };

export async function albumOnProfileOf(ctx: QueryCtx, member: MemberId): Promise<AlbumShown> {
  return (await albumShownTo(ctx, member)) ? { album: true } : {};
}
