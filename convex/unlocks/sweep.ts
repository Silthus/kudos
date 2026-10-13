import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { republish } from "../feedback/homes";
import { notifyFeaturesShipped } from "../feedback/notify";
import { levelOf } from "../progression/levels";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { shippedIn, type ScheduledFeature } from "./schedule";
import { reachedAt, storeReadiness } from "./unlocks";

export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const shipped = shipStates(ctx);
    for await (const member of ctx.db.query("members")) {
      if (member.kind !== "member") continue;
      await makeShippedReady(ctx, member, await shipped(member.workspace));
    }
  },
});

async function makeShippedReady(ctx: MutationCtx, { _id: member, workspace }: Doc<"members">, shipped: ScheduledFeature[]) {
  if (shipped.length === 0) return;
  const madeReady = await storeReadiness(ctx, { workspace, member, at: Date.now() }, reachedAt(shipped, await levelOfMember(ctx, member)));
  if (madeReady.length === 0) return;
  await notifyFeaturesShipped(ctx, member, madeReady);
  if (await xpLevelsShownIn(ctx, workspace)) await republish(ctx, member);
}

function shipStates(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<ScheduledFeature[]>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, shippedIn(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}

async function levelOfMember(ctx: MutationCtx, member: Doc<"members">["_id"]) {
  const progress = await ctx.db
    .query("memberProgress")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return levelOf(progress?.xp ?? 0);
}
