import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, membersNamedIn, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import type { MessageRef } from "../engine/messageEvent";
import { gateDecisionOf } from "../progression/gate";
import type { MemberId } from "../workspace/directory";
import type { GroupId } from "./groups";
import { primaryGroupAt } from "./history";
import { reconcilePageOf } from "./reconcile";

export const attributeKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator, unreconciled: v.optional(v.array(v.id("members"))) },
  handler: async (ctx, { event, unreconciled }) => {
    if (await wasAttributed(ctx, event.message)) return;
    const left = await reconcilePageOf(ctx, unreconciled ?? membersNamedIn(event));
    if (left.length > 0) {
      await ctx.scheduler.runAfter(0, internal.groups.attribution.attributeKudosGiven, { event, unreconciled: left });
      return;
    }
    const people = membersNamedIn(event);
    const groupAtSpend = await primaryGroupsAt(ctx, people, event.at);
    const attribution = attributionOf(event, groupAtSpend);
    await ctx.db.insert("attributions", { ...attribution.message, ...attribution.facts });
    await publish(ctx, { type: "awardsAttributed", message: attribution.message, ...attribution.facts });
  },
});

function attributionOf({ workspace, message, giver, awards, annotations, day, at }: KudosGivenEvent, groupAtSpend: Map<MemberId, GroupId | null>) {
  const saysWhy = gateDecisionOf(annotations)?.thoughtful === true;
  const attributed = awards.map(({ award, recipient, kudos }) => ({ award, recipient, kudos, saysWhy, recipientGroup: groupAtSpend.get(recipient) ?? null }));
  const kudos = awards.reduce((sum, award) => sum + award.kudos, 0);
  return { message, facts: { workspace, giver, group: groupAtSpend.get(giver) ?? null, kudos, day, at, awards: attributed } };
}

async function primaryGroupsAt(ctx: QueryCtx, people: MemberId[], at: number) {
  return new Map(await Promise.all(people.map(async (member) => [member, await primaryGroupAt(ctx, member, at)] as const)));
}

async function wasAttributed(ctx: MutationCtx, { workspace, conversation, message }: MessageRef) {
  const attribution = await ctx.db
    .query("attributions")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
  return attribution !== null;
}
