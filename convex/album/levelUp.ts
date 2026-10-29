import type { QueryCtx } from "../_generated/server";
import type { Drop } from "./hoggies/drops";
import { hiddenItemsShownTo } from "./items/flag";
import { levelUpEarned, levelUpHoggiesOf, levelUpRevealOnFor } from "./levelUpHoggies";
import { levelUpAt, levelUpBefore, levelUpRecordedAt } from "../unlocks/levelUps";
import type { MemberId } from "../workspace/directory";
import { levelEmojisEarnedIn, type EarnedEmoji } from "./earnedEmojis";
import { albumShownTo } from "./flag";
import type { PageOwner } from "./teamPages";

export type LevelUpAnswer = { kind: "levelUp"; level: number; at: number; hoggies: Drop[]; emojis: EarnedEmoji[] };

export async function levelUpRevealShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await albumShownTo(ctx, member)) && (await levelUpRevealOnFor(ctx, member)) && !(await hiddenItemsShownTo(ctx, member));
}

export async function levelUpRevealOf(ctx: QueryCtx, owner: PageOwner, level: number): Promise<LevelUpAnswer | null> {
  const at = await levelUpAt(ctx, owner.member, level);
  if (at === null) return null;
  const hoggies = await levelUpHoggiesOf(ctx, owner.member, level);
  if (hoggies.length === 0) return null;
  const above = await levelUpBefore(ctx, owner.member, level);
  return { kind: "levelUp", level, at, hoggies, emojis: await levelEmojisEarnedIn(ctx, owner, { above, upTo: level, at }) };
}

export async function levelUpRevealedTo(ctx: QueryCtx, member: MemberId, level: number): Promise<boolean> {
  return (await levelUpRevealShownTo(ctx, member)) && (await levelUpHoggiesOf(ctx, member, level)).length > 0;
}

const followerAwaitedMs = 5000;

export async function levelUpFollowerAwaitedUntil(ctx: QueryCtx, member: MemberId, level: number): Promise<number | null> {
  const recordedAt = await levelUpRecordedAt(ctx, member, level);
  if (recordedAt === null || (await levelUpEarned(ctx, member, level))) return null;
  return recordedAt + followerAwaitedMs;
}
