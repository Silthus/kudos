import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { EffectsRecord } from "./progress";

export async function insertEffects(ctx: MutationCtx, effects: EffectsRecord[]) {
  for (const record of effects) await ctx.db.insert("effectsRecords", record);
}

export async function anyRecorded(ctx: QueryCtx, effects: EffectsRecord[]) {
  for (const { award, side } of effects) {
    const recorded = await ctx.db
      .query("effectsRecords")
      .withIndex("by_award", (q) => q.eq("award", award).eq("side", side))
      .first();
    if (recorded !== null) return true;
  }
  return false;
}
