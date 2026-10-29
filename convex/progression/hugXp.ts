import type { QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import { hugXp } from "../hugs/xp";
import { totalsOf } from "../leaderboard/counts";
import { keyOf } from "../leaderboard/periods";
import type { MemberId } from "../workspace/directory";
import { rewardOf } from "./rewards";

export type HugWeekXp = { given: number; givenXp: number; received: number; receivedXp: number };

const daysInAWeek = 7;
const dayMs = 24 * 60 * 60 * 1000;

export async function hugXpOf(ctx: QueryCtx, member: MemberId, week: DayKey): Promise<HugWeekXp> {
  const { hugsGiven, hugsReceived } = await totalsOf(ctx, member, keyOf("week", week));
  return {
    given: hugsGiven,
    givenXp: hugsGiven * hugXp + (await dayBonusesOf(ctx, member, week)),
    received: hugsReceived,
    receivedXp: hugsReceived * hugXp + (await xpPaidUnder(ctx, member, `hug-week:${week}`)),
  };
}

async function dayBonusesOf(ctx: QueryCtx, member: MemberId, week: DayKey) {
  let xp = 0;
  for (const day of daysOf(week)) xp += await xpPaidUnder(ctx, member, `hug-day:${day}`);
  return xp;
}

async function xpPaidUnder(ctx: QueryCtx, member: MemberId, key: string) {
  return (await rewardOf(ctx, member, key))?.xp ?? 0;
}

function daysOf(monday: DayKey): DayKey[] {
  const start = Date.parse(`${monday}T00:00:00Z`);
  return Array.from({ length: daysInAWeek }, (_, day) => new Date(start + day * dayMs).toISOString().slice(0, 10));
}
