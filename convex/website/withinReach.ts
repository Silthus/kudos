import type { QueryCtx } from "../_generated/server";
import { hypeEmojiOf, levelEmojiOf, teamEmojiOf, type EmojiProgress, type ShownEmoji } from "../album/earnedEmojis";
import type { Nudge } from "../album/hypeReactions";
import { emojiLevelsOf } from "../album/levelEmojis";
import { teamPagesOf, type PageOwner, type TeamPage } from "../album/teamPages";
import { xpToReach } from "../progression/levels";
import { standingOf } from "../progression/progression";
import { faceIn, type AlbumPersonFace } from "./albumPages";

export type ReachableEmoji = { emoji: ShownEmoji; progress: EmojiProgress };

export type WithinReach = { hype: (ReachableEmoji & { person: AlbumPersonFace }) | null; team: (ReachableEmoji & { teamName: string }) | null; level: (ReachableEmoji & { level: number }) | null };

export async function withinReachOf(ctx: QueryCtx, owner: PageOwner, nudge: Nudge | null): Promise<WithinReach> {
  return { hype: await hypeWithinReachOf(ctx, owner, nudge), team: await teamWithinReachOf(ctx, owner), level: await levelWithinReachOf(ctx, owner) };
}

async function hypeWithinReachOf(ctx: QueryCtx, { workspace }: PageOwner, nudge: Nudge | null): Promise<WithinReach["hype"]> {
  const emoji = nudge === null ? null : await hypeEmojiOf(ctx, workspace, nudge.person);
  if (nudge === null || emoji === null) return null;
  return { person: await faceIn(ctx, workspace, nudge.person), emoji, progress: { have: 0, need: 1 } };
}

async function teamWithinReachOf(ctx: QueryCtx, owner: PageOwner): Promise<WithinReach["team"]> {
  const page = (await teamPagesOf(ctx, owner)).find(isMineStillCollecting);
  const emoji = page === undefined ? null : await teamEmojiOf(ctx, owner.workspace, page);
  if (page === undefined || emoji === null) return null;
  return { teamName: page.name, emoji, progress: { have: page.held, need: page.total } };
}

function isMineStillCollecting({ mine, state, held, total }: TeamPage): boolean {
  return mine && state === "progress" && held < total;
}

async function levelWithinReachOf(ctx: QueryCtx, { workspace, member }: PageOwner): Promise<WithinReach["level"]> {
  const { level, xp } = await standingOf(ctx, member);
  const next = (await emojiLevelsOf(ctx, member)).find((reward) => reward > level);
  const emoji = next === undefined ? null : await levelEmojiOf(ctx, workspace, next);
  if (next === undefined || emoji === null) return null;
  return { level: next, emoji, progress: { have: xp, need: xpToReach(next) } };
}
