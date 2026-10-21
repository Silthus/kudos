import type { MutationCtx, QueryCtx } from "../_generated/server";
import { earnTeamItem } from "../items/achievements";
import { teamEmojiNameOf } from "./emojiNames";
import { recordMilestonesOf } from "./milestones";
import type { Instants } from "./packs";
import type { TeamSticker } from "./records";
import { markEmojiSeen } from "./earnedEmojis";
import { teamPagesOf, type PageOwner, type TeamPage } from "./teamPages";

export async function unlockTeamStickerOf(ctx: MutationCtx, owner: PageOwner, team: string, at: number): Promise<TeamSticker | null> {
  const page = (await teamPagesOf(ctx, owner)).find((page) => page.team === team);
  if (page?.state !== "ready") return null;
  const sticker = await insertTeamSticker(ctx, owner, page, at);
  await recordMilestonesOf(ctx, owner, at);
  return sticker;
}

export async function unlockReadyTeamsAmong(ctx: MutationCtx, owner: PageOwner, pages: TeamPage[], at: number): Promise<TeamSticker[]> {
  const unlocked: TeamSticker[] = [];
  for (const page of pages.filter(({ state }) => state === "ready")) {
    unlocked.push(await insertTeamSticker(ctx, owner, page, at));
    await markEmojiSeen(ctx, owner.member, `team:${page.team}`, at);
  }
  return unlocked;
}

async function insertTeamSticker(ctx: MutationCtx, owner: PageOwner, { team, name, art }: TeamPage, at: number): Promise<TeamSticker> {
  const sticker = { team, name, art, emoji: await teamEmojiNameOf(ctx, owner.workspace, team), at };
  await ctx.db.insert("teamStickers", { member: owner.member, workspace: owner.workspace, ...sticker });
  await earnTeamItem(ctx, owner, { team, name }, at);
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
