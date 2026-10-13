import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, membersNamedIn } from "../bus/events";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";
import { catalogue } from "./catalogue";
import { anyRecorded, insertEffects } from "./effects";
import { progress, standing, xpToNextLevel, type MemberProgress, type Standing } from "./progress";

export const recordEffects = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    for (const member of membersNamedIn(event)) {
      const { state, effects, events } = progress(await progressOf(ctx, member), event, catalogue);
      if (await anyRecorded(ctx, effects)) continue;
      await insertEffects(ctx, effects);
      await saveProgress(ctx, state);
      for (const levelReached of events) await publish(ctx, levelReached);
    }
  },
});

export async function standingOf(ctx: QueryCtx, member: MemberId): Promise<Standing> {
  return standing(await progressOf(ctx, member));
}

export type ProgressionHome = Standing & { xpToNextLevel: number };

export async function progressionHomeOf(ctx: QueryCtx, member: MemberId): Promise<ProgressionHome> {
  const memberStanding = await standingOf(ctx, member);
  return { ...memberStanding, xpToNextLevel: xpToNextLevel(memberStanding) };
}

async function progressOf(ctx: QueryCtx, member: MemberId): Promise<MemberProgress> {
  const row = await progressRow(ctx, member);
  return { member, xp: row?.xp ?? 0, pointsSpent: row?.pointsSpent ?? 0 };
}

async function saveProgress(ctx: MutationCtx, { member, xp, pointsSpent }: MemberProgress) {
  const row = await progressRow(ctx, member);
  if (row === null) await ctx.db.insert("memberProgress", { member, xp, pointsSpent });
  else await ctx.db.patch(row._id, { xp, pointsSpent });
}

function progressRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("memberProgress")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
