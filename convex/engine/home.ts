import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { allowanceDay, allowanceLeft, weekOf } from "./allowance";
import { weekTotals, type WeekTotals } from "./awards";
import { lifetimeTotals, type LifetimeTotals } from "./totals";

export type KudosHome = { left: number; base: number; kudosEmoji: string } & WeekTotals & LifetimeTotals;

export async function kudosHomeOf(ctx: QueryCtx, workspace: string, member: MemberId, timeZone: string | undefined): Promise<KudosHome> {
  const { baseAllowance, kudosEmoji } = await settingsOf(ctx, workspace);
  const today = allowanceDay(Date.now(), timeZone);
  return {
    left: await allowanceLeft(ctx, member, today, baseAllowance),
    base: baseAllowance,
    kudosEmoji,
    ...(await weekTotals(ctx, member, weekOf(today))),
    ...(await lifetimeTotals(ctx, member)),
  };
}
