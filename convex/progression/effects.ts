import type { MutationCtx, QueryCtx } from "../_generated/server";
import { weekOf, type DayKey } from "../engine/allowance";
import { awardAt, givenEarlierInWeek, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import { gateDecisionOf } from "./gate";
import type { GateDecision } from "./gate";
import { bonusPaidIn, type BonusLine, type EffectsRecord, type Side, type ThoughtfulAward } from "./progress";

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

export async function xpRecordedFor(ctx: QueryCtx, award: AwardId, side: Side): Promise<number | null> {
  const recorded = await recordOf(ctx, award, side);
  if (recorded === null) return null;
  return recorded.baseXp + bonusPaidIn([recorded]).reduce((sum, { xp }) => sum + xp, 0);
}

export async function gateRecordedWith(ctx: QueryCtx, award: AwardId): Promise<GateDecision | null> {
  return (await giverRecordOf(ctx, award))?.gate ?? null;
}

export async function bonusRecordedWith(ctx: QueryCtx, awards: AwardId[]): Promise<BonusLine[]> {
  const recorded = await Promise.all(awards.map((award) => giverRecordOf(ctx, award)));
  return bonusPaidIn(recorded.filter((record) => record !== null));
}

function giverRecordOf(ctx: QueryCtx, award: AwardId) {
  return recordOf(ctx, award, "giver");
}

function recordOf(ctx: QueryCtx, award: AwardId, side: Side) {
  return ctx.db
    .query("effectsRecords")
    .withIndex("by_award", (q) => q.eq("award", award).eq("side", side))
    .first();
}

export async function thoughtfulAwardsBefore(ctx: QueryCtx, giver: MemberId, day: DayKey, award: AwardId): Promise<ThoughtfulAward[]> {
  const earlier = await givenEarlierInWeek(ctx, giver, weekOf(day), award);
  return earlier.filter(({ annotations }) => gateDecisionOf(annotations)?.thoughtful === true).map(({ recipient, day }) => ({ recipient, day }));
}

export async function gaveThoughtfulKudos(ctx: QueryCtx, giver: MemberId, atOrBefore: number): Promise<boolean> {
  const given = ctx.db.query("effectsRecords").withIndex("by_member_side", (q) => q.eq("member", giver).eq("side", "giver"));
  for await (const { gate, award } of given) {
    if (gate?.thoughtful === true && ((await awardAt(ctx, award)) ?? Infinity) <= atOrBefore) return true;
  }
  return false;
}
