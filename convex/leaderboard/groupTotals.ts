import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsAttributedEventValidator, type AwardsAttributedEvent } from "../bus/events";
import type { MessageRef } from "../engine/messageEvent";
import type { GroupId } from "../groups/groups";
import { dayOfPeriod, keyOf, periods, type Period } from "./periods";
import { withKudosOn } from "./runningTotal";

type AttributedToGroup = AwardsAttributedEvent & { group: GroupId };

export const countAwardsAttributed = internalMutation({
  args: { event: awardsAttributedEventValidator },
  handler: async (ctx, { event }) => {
    if (event.group === null || (await wasCounted(ctx, event.message))) return;
    await ctx.db.insert("countedAttributions", event.message);
    for (const period of periods) await addToPeriod(ctx, { ...event, group: event.group }, period);
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

async function wasCounted(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  const counted = await ctx.db
    .query("countedAttributions")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
  return counted !== null;
}
