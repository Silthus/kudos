import type { QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import type { WeekList } from "./records";
import { weekRowOf } from "./tallies";

const listsOfThanksReceived: WeekList[] = ["thankedBy", "huggedBy"];

export async function hoggiesFoundIn(ctx: QueryCtx, member: MemberId, week: DayKey): Promise<number> {
  const found = (await weekRowOf(ctx, member, week))?.hoggiesFound;
  return found === undefined ? 0 : found.hoggies.length + found.more;
}

export async function teammatesWhoThanked(ctx: QueryCtx, member: MemberId, week: DayKey): Promise<number> {
  const thankers = new Set<MemberId>();
  for (const list of listsOfThanksReceived) for (const { person } of await peopleListed(ctx, member, week, list)) thankers.add(person);
  return thankers.size;
}

export async function teammatesThankedBy(ctx: QueryCtx, member: MemberId): Promise<number> {
  const pairs = await ctx.db
    .query("pairTallies")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .collect();
  return pairs.filter(({ kudosGiven, hugsGiven }) => kudosGiven + hugsGiven > 0).length;
}

function peopleListed(ctx: QueryCtx, member: MemberId, week: DayKey, list: WeekList) {
  return ctx.db
    .query("weekPeople")
    .withIndex("by_member_week_list_person", (q) => q.eq("member", member).eq("week", week).eq("list", list))
    .collect();
}
