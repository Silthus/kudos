import type { MutationCtx, QueryCtx } from "../_generated/server";
import { awardsGivenBy, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { EffectsRecord, Side } from "./progress";

export async function insertEffects(ctx: MutationCtx, effects: EffectsRecord[]) {
  for (const record of effects) await ctx.db.insert("effectsRecords", record);
}

export async function isRecorded(ctx: QueryCtx, award: AwardId, side: Side) {
  const recorded = await ctx.db
    .query("effectsRecords")
    .withIndex("by_award", (q) => q.eq("award", award).eq("side", side))
    .first();
  return recorded !== null;
}

export async function gaveThoughtfulKudos(ctx: QueryCtx, giver: MemberId, atOrBefore: number): Promise<boolean> {
  for (const award of await awardsGivenBy(ctx, giver, atOrBefore)) {
    const given = await ctx.db
      .query("effectsRecords")
      .withIndex("by_award", (q) => q.eq("award", award).eq("side", "giver"))
      .first();
    if (given?.gate?.thoughtful === true) return true;
  }
  return false;
}
