import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type DayKey = string;

export type DailyAllowance = { opening: number; left: number; spend(kudos: number): Promise<void> };

export function allowanceDay(at: number, timeZone: string | undefined): DayKey {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(at);
}

export async function dailyAllowance(ctx: MutationCtx, giver: MemberId, day: DayKey, base: number): Promise<DailyAllowance> {
  const spending = await ctx.db
    .query("allowanceSpending")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .unique();
  const spent = spending?.spent ?? 0;
  return {
    opening: base,
    left: Math.max(0, base - spent),
    async spend(kudos) {
      if (spending === null) await ctx.db.insert("allowanceSpending", { giver, day, spent: kudos });
      else await ctx.db.patch(spending._id, { spent: spent + kudos });
    },
  };
}
