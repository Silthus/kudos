import type { QueryCtx } from "../_generated/server";
import { onboardingShownTo } from "../items/onboardingFlag";
import type { MemberId } from "../workspace/directory";
import { emojiLevels, everyEmojiLevel, levelTwoEmoji } from "./emojiCatalogue";

export async function emojiLevelsOf(ctx: QueryCtx, member: MemberId): Promise<readonly number[]> {
  return (await onboardingShownTo(ctx, member)) ? everyEmojiLevel : emojiLevels;
}

export async function isEmojiLevelOf(ctx: QueryCtx, member: MemberId, level: number): Promise<boolean> {
  if (emojiLevels.some((reward) => reward === level)) return true;
  return level === levelTwoEmoji.level && (await onboardingShownTo(ctx, member));
}
