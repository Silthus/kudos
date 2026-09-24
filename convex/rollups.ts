import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { bucketDays, dayBucket, monthBucket, periodBucketsBetween, weekBucket } from "./lib/buckets";
import { RARITIES } from "./lib/messages";
import { channelKey, WORKSPACE_COUNTERS } from "./lib/rollups";
import { kudosInRange, totalsByMember, workspaceDays } from "./lib/stats";
import {
  markBackfilled,
  mirrorBackfillMarker,
  rebuildGiverPairs,
  rebuildMemberAll,
  rebuildMemberYear,
  rebuildWorkspaceAll,
  rebuildWorkspaceDay,
  rebuildWorkspacePeriod,
  sourceSpan,
} from "./lib/rebuild";
import { addDays, DAY_MS, dayKeyFor, daysBetween, startOfDayUtc, weekdayOfKey, zonedParts } from "./lib/time";

/**
 * Backfill and repair of the read-model rollups (see `lib/rebuild.ts`). `rebuildWorkspace` walks a
 * workspace through chained steps, each its own transaction:
 *
 *   days     every `d:` workspace row in the span, a week per step
 *   members  per member, one step per year (their w/m/q/y member and pair rows), then one step
 *            for totals, giving profile and all-time pairs
 *   periods  one w/m/q/y bucket per step (weeks, then months, then quarters and years, which
 *            build on months), after the day and member rows they sum
 *   all      the all-time row and channels, then `rollupsBackfilledAt` on the `all` row
 *
 * Live gives and revokes keep running throughout; every unit overwrites absolute values, so the
 * result is exact. Running it again is harmless, which makes it the repair tool too.
 *
 * A demo reset rewrites the sources outside the engine. A run remembers the reset it belongs to
 * (`resetAt`, the workspace's `resettingSince` when it started) and stops as soon as that changes,
 * so a run that started before a reset can never mark the half-seeded rollups as backfilled. The
 * reset's own run releases the reset lock when it finishes.
 */

const DAYS_PER_STEP = 7;

const phaseValidator = v.union(v.literal("days"), v.literal("members"), v.literal("periods"), v.literal("all"));
type Phase = Infer<typeof phaseValidator>;

/** Start a full rebuild of one workspace's rollups. */
export const rebuildWorkspace = internalMutation({
  args: { workspaceId: v.id("workspaces"), resetAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.resettingSince !== resetAt) return null;
    const { from, to } = await sourceSpan(ctx, workspace, dayKeyFor(Date.now(), workspace.timezone));
    await ctx.scheduler.runAfter(0, internal.rollups.backfillStep, { workspaceId, resetAt, from, to, phase: "days", cursor: from });
    return null;
  },
});

/** Start the backfill for every workspace. */
export const backfillAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const workspace of ctx.db.query("workspaces")) {
      if (workspace.resettingSince !== undefined) continue; // the reset rebuilds it
      await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId: workspace._id });
    }
    return null;
  },
});

/**
 * One-off after deploying #29: copy the `all` row's backfill marker onto workspaces backfilled
 * before `markBackfilled` also marked the workspace document. Idempotent; one read per workspace.
 */
export const mirrorBackfillMarkers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const workspace of ctx.db.query("workspaces")) await mirrorBackfillMarker(ctx, workspace);
    return null;
  },
});

export const backfillStep = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    resetAt: v.optional(v.number()),
    from: v.string(),
    to: v.string(),
    phase: phaseValidator,
    cursor: v.optional(v.string()), // days: next day; members: current member; periods: bucket index
    year: v.optional(v.number()), // members: the year to rebuild next, past the span = all time
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, resetAt, from, to, phase, cursor, year }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.resettingSince !== resetAt) return null; // superseded by a demo reset
    const next = (phase: Phase, cursor?: string, year?: number) =>
      ctx.scheduler.runAfter(0, internal.rollups.backfillStep, { workspaceId, resetAt, from, to, phase, cursor, year });
    const [firstYear, lastYear] = [Number(from.slice(0, 4)), Number(to.slice(0, 4))];

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
        // Without a year: start on the member after `cursor`, with the span's first year.
        const member = await ctx.db
          .query("members")
          .withIndex("by_workspace_slackUser", (q) =>
            cursor === undefined
              ? q.eq("workspaceId", workspaceId)
              : year === undefined
                ? q.eq("workspaceId", workspaceId).gt("slackUserId", cursor)
                : q.eq("workspaceId", workspaceId).eq("slackUserId", cursor),
          )
          .first();
        const unit = year ?? firstYear;
        if (!member) {
          await (year === undefined ? next("periods", "0") : next("members", cursor));
        } else if (unit <= lastYear) {
          await rebuildMemberYear(ctx, workspace, member._id, unit);
          await rebuildGiverPairs(ctx, workspace, member._id, unit);
          await next("members", member.slackUserId, unit + 1);
        } else {
          await rebuildMemberAll(ctx, workspace, member);
          await next("members", member.slackUserId);
        }
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
        if (resetAt !== undefined) await ctx.db.patch(workspaceId, { resettingSince: undefined });
        return null;
      }
    }
  },
});

const MAX_MISMATCHES = 100;

const mismatch = v.object({
  bucket: v.string(),
  table: v.string(),
  key: v.string(),
  field: v.string(),
  expected: v.number(),
  actual: v.number(),
});

/**
 * Compare sampled rollup buckets with the legacy computation: the readers' own sums over
 * `memberDays` (lib/stats) and a scan of the bucket's kudos and first discoveries. Pass explicit
 * `d:`/`w:`/`m:`/`q:`/`y:` buckets, or get the latest active day, its week and its month. Years
 * and quarters read every kudos row in them, so sample those on small workspaces only.
 */
export const verify = internalQuery({
  args: { workspaceId: v.id("workspaces"), buckets: v.optional(v.array(v.string())) },
  returns: v.object({ checked: v.array(v.string()), mismatches: v.array(mismatch) }),
  handler: async (ctx, { workspaceId, buckets }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new ConvexError("Unknown workspace");
    let checked = buckets;
    if (!checked) {
      const latest = await ctx.db
        .query("memberDays")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
        .order("desc")
        .first();
      checked = latest ? [dayBucket(latest.dayKey), weekBucket(latest.dayKey), monthBucket(latest.dayKey)] : [];
    }
    const mismatches: Infer<typeof mismatch>[] = [];
    for (const bucket of checked) {
      for (const m of await verifyBucket(ctx, workspace, bucket)) {
        if (mismatches.length < MAX_MISMATCHES) mismatches.push(m);
      }
    }
    return { checked, mismatches };
  },
});

async function verifyBucket(ctx: QueryCtx, workspace: Doc<"workspaces">, bucket: string) {
  const { start, end } = bucketDays(bucket);
  const tz = workspace.timezone;
  const out: Infer<typeof mismatch>[] = [];
  const compare = (table: string, expected: Map<string, Record<string, number>>, actual: Map<string, Record<string, number>>) => {
    for (const key of [...new Set([...expected.keys(), ...actual.keys()])].sort()) {
      const e = expected.get(key) ?? {};
      const a = actual.get(key) ?? {};
      for (const field of [...new Set([...Object.keys(e), ...Object.keys(a)])]) {
        if ((e[field] ?? 0) !== (a[field] ?? 0)) {
          out.push({ bucket, table, key, field, expected: e[field] ?? 0, actual: a[field] ?? 0 });
        }
      }
    }
  };

  // The legacy readers' computation: per-member sums over the bucket's memberDays.
  const days = await workspaceDays(ctx, workspace._id, { start, end, days: daysBetween(start, end) + 1 }, 15_000);
  const { rows: kudosRows, truncated } = await kudosInRange(
    ctx,
    workspace._id,
    startOfDayUtc(start, tz) - DAY_MS, // a day key may come from another timezone
    startOfDayUtc(addDays(end, 1), tz) + DAY_MS,
    15_000,
  );
  if (days.truncated || truncated) throw new ConvexError(`${bucket} is too large to verify in one query`);
  const kudos = kudosRows.filter((k) => k.dayKey >= start && k.dayKey <= end);
  const perMember = totalsByMember(days.rows);

  const ws: Record<string, number> = {
    given: 0, kudosRows: 0, fromReactions: 0, fromMessages: 0,
    givers: [...perMember.values()].filter((m) => m.given > 0).length,
    receivers: [...perMember.values()].filter((m) => m.received > 0).length,
    giverDays: days.rows.filter((d) => d.given > 0).length,
    maxedDays: days.rows.filter((d) => d.maxed).length,
    cappedGiven: days.rows.reduce((n, d) => n + (d.capped ?? Math.min(d.given, workspace.dailyLimit)), 0),
    messages: new Set(kudos.map((k) => k.batchId)).size,
  };
  const channels = new Map<string, Record<string, number>>();
  const pairs = new Map<string, Record<string, number>>();
  const bump = (m: Map<string, Record<string, number>>, key: string, n: number) =>
    m.set(key, { amount: (m.get(key)?.amount ?? 0) + n });
  for (const k of kudos) {
    ws.given += k.amount;
    ws.kudosRows += 1;
    if (k.source === "reaction") ws.fromReactions += k.amount;
    else ws.fromMessages += k.amount;
    const hour = k.hour ?? zonedParts(k.at, tz).hour;
    const cell = `heat[${bucket.startsWith("d:") ? hour : weekdayOfKey(k.dayKey) * 24 + hour}]`;
    ws[cell] = (ws[cell] ?? 0) + k.amount;
    bump(channels, channelKey(k), k.amount);
    bump(pairs, `${k.giverId}>${k.receiverId}`, k.amount);
  }
  const firstSeen = ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) =>
      q.eq("workspaceId", workspace._id).gte("firstSeenAt", startOfDayUtc(start, tz)).lt("firstSeenAt", startOfDayUtc(addDays(end, 1), tz)),
    );
  for await (const d of firstSeen) ws[`found.${d.rarity}`] = (ws[`found.${d.rarity}`] ?? 0) + 1;

  const row = await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket))
    .unique();
  const stored: Record<string, number> = {};
  if (row) {
    for (const c of WORKSPACE_COUNTERS) stored[c] = row[c];
    row.heat.forEach((n, i) => (stored[`heat[${i}]`] = n));
    for (const r of RARITIES) stored[`found.${r}`] = row.found[r];
  }
  compare("workspaceStats", new Map([[bucket, ws]]), new Map([[bucket, stored]]));
  if (bucket.startsWith("d:")) return out; // the day bucket of members and pairs is memberDays itself

  const storedChannels = await ctx.db
    .query("channelStats")
    .withIndex("by_workspace_bucket_channel", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket))
    .collect();
  compare("channelStats", channels, new Map(storedChannels.map((c) => [c.channel, { amount: c.amount }])));

  const expectedMembers = new Map(
    [...perMember].filter(([, t]) => t.given + t.received > 0).map(([id, t]) => [id as string, { ...t }]),
  );
  const storedMembers = new Map<string, Record<string, number>>();
  const memberRows = ctx.db
    .query("memberStats")
    .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket));
  for await (const m of memberRows) {
    storedMembers.set(m.memberId, { given: m.given, received: m.received, maxedDays: m.maxedDays, activeDays: m.activeDays });
  }
  compare("memberStats", expectedMembers, storedMembers);

  const storedPairs = new Map<string, Record<string, number>>();
  const pairRows = ctx.db
    .query("pairStats")
    .withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket));
  for await (const p of pairRows) storedPairs.set(`${p.giverId}>${p.receiverId}`, { amount: p.amount });
  compare("pairStats", pairs, storedPairs);
  return out;
}
