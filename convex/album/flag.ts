import { memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
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

export const emojiMappingInPlaceFlag = { key: "emoji-mapping-in-place", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function emojiMappingInPlaceShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, emojiMappingInPlaceFlag, member);
}

export const shareableUrlsFlag = { key: "shareable-urls", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function shareableUrlsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, shareableUrlsFlag, member);
}

export const ownHypePickFlag = { key: "own-hype-pick", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function ownHypePickShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, ownHypePickFlag, member);
}

export const adminHypeEmojisFlag = { key: "admin-hype-emojis", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function adminHypeEmojisShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, adminHypeEmojisFlag, member);
}

export const kudosEmojiPicksFlag = { key: "kudos-emoji-picks", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function kudosEmojiPicksShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, kudosEmojiPicksFlag, member);
}

export function kudosEmojiPicksCountFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, kudosEmojiPicksFlag, member);
}

export type AlbumShown = { album?: true };

export async function albumOnProfileOf(ctx: QueryCtx, member: MemberId): Promise<AlbumShown> {
  return (await albumShownTo(ctx, member)) ? { album: true } : {};
}

export const personPageDFlag = { key: "person-page-d", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function personPageDShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, personPageDFlag, member);
}
