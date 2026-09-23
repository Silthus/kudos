import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { periodBucketsBetween } from "./lib/buckets";
import {
  markBackfilled,
  rebuildGiverPairs,
  rebuildMemberAll,
  rebuildMemberYear,
  rebuildWorkspaceAll,
  rebuildWorkspaceDay,
  rebuildWorkspacePeriod,
  sourceSpan,
} from "./lib/rebuild";
import { addDays, dayKeyFor } from "./lib/time";

/**
 * Backfill and repair of the read-model rollups (see `lib/rebuild.ts`). `rebuildWorkspace` walks a
 * workspace through chained steps, each its own transaction:
 *
 *   days     every `d:` workspace row in the source span, a week per step
 *   members  one member per step: their w/m/q/y member and pair rows per year, then totals,
 *            giving profile and all-time pairs
 *   periods  one w/m/q/y bucket per step (weeks, then months, then quarters and years, which
 *            build on months), after the day and member rows they sum
 *   all      the all-time row and channels, then `rollupsBackfilledAt` on the `all` row
 *
 * Live gives and revokes keep running throughout; every unit overwrites absolute values, so the
 * result is exact. Running it again is harmless, which makes it the repair tool too.
 */

const DAYS_PER_STEP = 7;

const phase = v.union(v.literal("days"), v.literal("members"), v.literal("periods"), v.literal("all"));

/** Start a full rebuild of one workspace's rollups. */
export const rebuildWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return null;
    const { from, to } = await sourceSpan(ctx, workspace, dayKeyFor(Date.now(), workspace.timezone));
    await ctx.scheduler.runAfter(0, internal.rollups.backfillStep, { workspaceId, from, to, phase: "days", cursor: from });
    return null;
  },
});

/** Start the backfill for every workspace. */
export const backfillAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const workspace of ctx.db.query("workspaces")) {
      await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId: workspace._id });
    }
    return null;
  },
});

export const backfillStep = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    from: v.string(),
    to: v.string(),
    phase,
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, from, to, phase, cursor }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return null;
    const next = (phase: "days" | "members" | "periods" | "all", cursor?: string) =>
      ctx.scheduler.runAfter(0, internal.rollups.backfillStep, { workspaceId, from, to, phase, cursor });

    switch (phase) {
      case "days": {
        let day = cursor ?? from;
        for (let i = 0; i < DAYS_PER_STEP && day <= to; i++, day = addDays(day, 1)) {
          await rebuildWorkspaceDay(ctx, workspace, day);
        }
        await (day <= to ? next("days", day) : next("members"));
        return null;
      }
      case "members": {
        const member = await ctx.db
          .query("members")
          .withIndex("by_workspace_slackUser", (q) =>
            cursor === undefined ? q.eq("workspaceId", workspaceId) : q.eq("workspaceId", workspaceId).gt("slackUserId", cursor),
          )
          .first();
        if (!member) {
          await next("periods", "0");
          return null;
        }
        for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
          await rebuildMemberYear(ctx, workspace, member._id, year);
          await rebuildGiverPairs(ctx, workspace, member._id, year);
        }
        await rebuildMemberAll(ctx, workspace, member);
        await next("members", member.slackUserId);
        return null;
      }
      case "periods": {
        const buckets = periodBucketsBetween(from, to);
        const index = Number(cursor ?? "0");
        await rebuildWorkspacePeriod(ctx, workspace, buckets[index]);
        await (index + 1 < buckets.length ? next("periods", String(index + 1)) : next("all"));
        return null;
      }
      case "all": {
        await rebuildWorkspaceAll(ctx, workspace);
        await markBackfilled(ctx, workspaceId, Date.now());
        return null;
      }
    }
  },
});
