import type { MutationCtx, QueryCtx } from "../_generated/server";
import { awardAt, type AwardId } from "../engine/awards";
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
  const given = ctx.db.query("effectsRecords").withIndex("by_member_side", (q) => q.eq("member", giver).eq("side", "giver"));
  for await (const { gate, award } of given) {
    if (gate?.thoughtful === true && ((await awardAt(ctx, award)) ?? Infinity) <= atOrBefore) return true;
  }
  return false;
}

export async function saidWhy(ctx: QueryCtx, award: AwardId): Promise<boolean> {
  const given = await ctx.db
    .query("effectsRecords")
    .withIndex("by_award", (q) => q.eq("award", award).eq("side", "giver"))
    .first();
  return given?.gate?.thoughtful === true;
}
