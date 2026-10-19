import type { MutationCtx } from "../_generated/server";
import { teamEmojiNameOf } from "./emojiNames";
import { recordMilestonesOf } from "./milestones";
import type { TeamSticker } from "./records";
import { teamPagesOf, type PageOwner } from "./teamPages";

export async function unlockTeamStickerOf(ctx: MutationCtx, owner: PageOwner, team: string, at: number): Promise<TeamSticker | null> {
  const page = (await teamPagesOf(ctx, owner)).find((page) => page.team === team);
  if (page?.state !== "ready") return null;
  const sticker = { team, name: page.name, art: page.art, emoji: await teamEmojiNameOf(ctx, owner.workspace, team), at };
  await ctx.db.insert("teamStickers", { member: owner.member, ...sticker });
  await recordMilestonesOf(ctx, owner, at);
  return sticker;
}
