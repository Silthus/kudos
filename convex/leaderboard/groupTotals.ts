import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsAttributedEventValidator, type AwardsAttributedEvent } from "../bus/events";
import type { MessageRef } from "../engine/messageEvent";
import type { GroupId } from "../groups/groups";
import type { MemberId } from "../workspace/directory";
import { dayOfPeriod, keyOf, periods, type Compared, type Period, type PeriodKey } from "./periods";
import { withKudosOn } from "./runningTotal";

type AttributedToGroup = AwardsAttributedEvent & { group: GroupId };

export type MemberTotals = { member: MemberId; totals: Array<Doc<"attributedTotals">> };

export const countAwardsAttributed = internalMutation({
  args: { event: awardsAttributedEventValidator },
  handler: async (ctx, { event }) => {
    if (event.group === null || (await wasCounted(ctx, event.message))) return;
    await ctx.db.insert("countedAttributions", event.message);
    for (const period of periods) await addToPeriod(ctx, { ...event, group: event.group }, period);
    for (const period of periods) await addToGroupPeriod(ctx, { ...event, group: event.group }, period);
  },
});

async function addToPeriod(ctx: MutationCtx, { workspace, group, giver, day, kudos }: AttributedToGroup, period: Period) {
  const key = keyOf(period, day);
  const row = await ctx.db
    .query("attributedTotals")
    .withIndex("by_member_group_period", (q) => q.eq("member", giver).eq("group", group).eq("period", key))
    .unique();
  const runningTotal = period === "all" ? {} : { runningTotal: withKudosOn(row?.runningTotal ?? [], dayOfPeriod(period, day), kudos) };
  if (row === null) await ctx.db.insert("attributedTotals", { workspace, group, member: giver, period: key, kudos, ...runningTotal });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos, ...runningTotal });
}

async function addToGroupPeriod(ctx: MutationCtx, { workspace, group, day, kudos }: AttributedToGroup, period: Period) {
  const key = keyOf(period, day);
  const row = await groupPeriodTotalOf(ctx, group, key);
  const runningTotal = period === "all" ? {} : { runningTotal: withKudosOn(row?.runningTotal ?? [], dayOfPeriod(period, day), kudos) };
  if (row === null) await ctx.db.insert("attributedGroupTotals", { workspace, group, period: key, kudos, ...runningTotal });
  else await ctx.db.patch(row._id, { kudos: row.kudos + kudos, ...runningTotal });
}

export function groupPeriodTotalOf(ctx: QueryCtx, group: GroupId, period: PeriodKey) {
  return ctx.db
    .query("attributedGroupTotals")
    .withIndex("by_group_period", (q) => q.eq("group", group).eq("period", period))
    .unique();
}

export async function memberTotalsOf(ctx: QueryCtx, member: MemberId, group: GroupId, { now, before }: Compared): Promise<MemberTotals> {
  const totals = await ctx.db
    .query("attributedTotals")
    .withIndex("by_member_group_period", (q) => q.eq("member", member).eq("group", group).gte("period", before?.key ?? now).lte("period", now))
    .collect();
  return { member, totals };
}

export async function groupMemberTotalsOf(ctx: QueryCtx, group: GroupId, members: MemberId[], { now, before }: Compared): Promise<MemberTotals[]> {
  const periods = before === null ? [now] : [before.key, now];
  const rows = (await Promise.all(periods.map((period) => groupPeriodRowsOf(ctx, group, period)))).flat();
  const byMember = new Map<MemberId, Array<Doc<"attributedTotals">>>();
  for (const row of rows) byMember.set(row.member, [...(byMember.get(row.member) ?? []), row]);
  return members.map((member) => ({ member, totals: byMember.get(member) ?? [] }));
}

function groupPeriodRowsOf(ctx: QueryCtx, group: GroupId, period: PeriodKey) {
  return ctx.db
    .query("attributedTotals")
    .withIndex("by_group_period", (q) => q.eq("group", group).eq("period", period))
    .collect();
}

async function wasCounted(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  const counted = await ctx.db
    .query("countedAttributions")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
  return counted !== null;
}
