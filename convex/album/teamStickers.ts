import type { MutationCtx, QueryCtx } from "../_generated/server";
import { teamEmojiNameOf } from "./emojiNames";
import { recordMilestonesOf } from "./milestones";
import type { Instants } from "./packs";
import type { TeamSticker } from "./records";
import { teamPagesOf, type PageOwner } from "./teamPages";

export async function unlockTeamStickerOf(ctx: MutationCtx, owner: PageOwner, team: string, at: number): Promise<TeamSticker | null> {
  const page = (await teamPagesOf(ctx, owner)).find((page) => page.team === team);
  if (page?.state !== "ready") return null;
  const sticker = { team, name: page.name, art: page.art, emoji: await teamEmojiNameOf(ctx, owner.workspace, team), at };
  await ctx.db.insert("teamStickers", { member: owner.member, workspace: owner.workspace, ...sticker });
  await recordMilestonesOf(ctx, owner, at);
  return sticker;
}

export type TeamStickersUnlocked = Pick<TeamSticker, "team" | "name" | "art"> & { count: number };

export async function teamStickersUnlockedIn(ctx: QueryCtx, workspace: string, { from, to }: Instants, most: number): Promise<TeamStickersUnlocked[]> {
  const unlocked = await ctx.db
    .query("teamStickers")
    .withIndex("by_workspace_at", (q) => q.eq("workspace", workspace).gte("at", from).lt("at", to))
    .take(most);
  const byTeam = new Map<string, TeamStickersUnlocked>();
  for (const { team, name, art } of unlocked) byTeam.set(team, { team, name, art, count: (byTeam.get(team)?.count ?? 0) + 1 });
  return [...byTeam.values()].sort((one, other) => other.count - one.count || one.name.localeCompare(other.name));
}
