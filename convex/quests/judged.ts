import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { awardIdValidator, type AwardId } from "../engine/awards";

export const questsJudgedValidator = v.object({ award: awardIdValidator });

export async function judgeQuestsOf(ctx: MutationCtx, awards: { award: AwardId }[]) {
  for (const { award } of awards) await ctx.db.insert("questsJudged", { award });
}

export async function questsJudgedFor(ctx: QueryCtx, awards: { award: AwardId }[]): Promise<boolean> {
  const judged = await Promise.all(awards.map(({ award }) => ctx.db.query("questsJudged").withIndex("by_award", (q) => q.eq("award", award)).first()));
  return judged.every((marker) => marker !== null);
}
