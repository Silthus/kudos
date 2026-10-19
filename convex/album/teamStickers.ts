import type { MutationCtx } from "../_generated/server";
import type { TeamCrestArt } from "../companyProfiles/teams";
import { teamEmojiNameOf } from "./emojiNames";
import { teamPagesOf, type PageOwner } from "./teamPages";

export type TeamSticker = { team: string; name: string; art: TeamCrestArt; emoji: string; at: number };

export async function unlockTeamStickerOf(ctx: MutationCtx, owner: PageOwner, team: string, at: number): Promise<TeamSticker | null> {
  const page = (await teamPagesOf(ctx, owner)).find((page) => page.team === team);
  if (page?.state !== "ready") return null;
  const emoji = await teamEmojiNameOf(ctx, owner.workspace, team);
  if (emoji === null) return null;
  const sticker = { team, name: page.name, art: page.art, emoji, at };
  await ctx.db.insert("teamStickers", { member: owner.member, ...sticker });
  return sticker;
}
