import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { awardIdValidator, type AwardId } from "../engine/awards";

export const questsJudgedValidator = v.object({ award: awardIdValidator });

export async function judgeQuestsOf(ctx: MutationCtx, awards: { award: AwardId }[]) {
  for (const { award } of awards) if ((await judgedMarkerOf(ctx, award)) === null) await ctx.db.insert("questsJudged", { award });
}

export async function questsJudgedFor(ctx: QueryCtx, awards: { award: AwardId }[]): Promise<boolean> {
  const judged = await Promise.all(awards.map(({ award }) => judgedMarkerOf(ctx, award)));
  return judged.every((marker) => marker !== null);
}

function judgedMarkerOf(ctx: QueryCtx, award: AwardId) {
  return ctx.db
    .query("questsJudged")
    .withIndex("by_award", (q) => q.eq("award", award))
    .first();
}
