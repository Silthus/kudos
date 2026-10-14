import type { MutationCtx, QueryCtx } from "../_generated/server";
import { weekOf, type DayKey } from "../engine/allowance";
import { awardAt, recipientOf, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { EffectsRecord, Side, ThoughtfulAward } from "./progress";

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

export async function thoughtfulAwardsInWeekOf(ctx: QueryCtx, giver: MemberId, day: DayKey): Promise<ThoughtfulAward[]> {
  const { monday, sunday } = weekOf(day);
  const given = ctx.db
    .query("effectsRecords")
    .withIndex("by_member_side_day", (q) => q.eq("member", giver).eq("side", "giver").gte("day", monday).lte("day", sunday));
  const thoughtful: ThoughtfulAward[] = [];
  for await (const { award, day: givenOn, gate } of given) {
    const recipient = gate?.thoughtful === true ? await recipientOf(ctx, award) : null;
    if (recipient !== null) thoughtful.push({ day: givenOn, recipient });
  }
  return thoughtful;
}

export async function gaveThoughtfulKudos(ctx: QueryCtx, giver: MemberId, atOrBefore: number): Promise<boolean> {
  const given = ctx.db.query("effectsRecords").withIndex("by_member_side", (q) => q.eq("member", giver).eq("side", "giver"));
  for await (const { gate, award } of given) {
    if (gate?.thoughtful === true && ((await awardAt(ctx, award)) ?? Infinity) <= atOrBefore) return true;
  }
  return false;
}
