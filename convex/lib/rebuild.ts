import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { RARITIES } from "./messages";
import { ALL_BUCKET, bucketDays, dayBucket, heatSize, memberBuckets, weekBucket } from "./buckets";
import {
  channelKey,
  MEMBER_COUNTERS,
  type MemberCounts,
  recomputeGivingProfile,
  WORKSPACE_COUNTERS,
  zeroFound,
  zeroMember,
} from "./rollups";
import { addDays, DAY_MS, startOfDayUtc, weekdayOfKey, zonedParts } from "./time";

/**
 * Recompute-from-source rebuild units. Each one reads the *whole* source range behind the rollup
 * rows it owns and overwrites them with absolute values (deleting rows that should be absent), so
 * it is idempotent and repairs any corruption. Transactions are serializable: a live give or revoke
 * touching the same sources either commits first (and is read here) or conflicts and applies its
 * delta on top of the exact value afterwards, so a rebuild running alongside live traffic stays
 * exact without a write freeze.
 *
 * Units that derive from other rollup rows (periods from day rows and member rows, `all` from
 * year rows and member totals) must run after the units that own those rows; the backfill driver
 * in `convex/rollups.ts` keeps that order. Every unit reads at most one member's year, one
 * workspace day or month of kudos, or one bucket's rows, so each stays well under the
 * per-transaction limits.
 */

type Workspace = Doc<"workspaces">;
export type WorkspaceValues = Pick<
  Doc<"workspaceStats">,
  (typeof WORKSPACE_COUNTERS)[number] | "heat" | "found"
>;

/** Every string starting with `prefix` sorts in [prefix, prefix + END). */
const END = "\uffff";

function emptyValues(bucket: string): WorkspaceValues {
  const counts = Object.fromEntries(WORKSPACE_COUNTERS.map((c) => [c, 0])) as Record<(typeof WORKSPACE_COUNTERS)[number], number>;
  return { ...counts, heat: new Array<number>(heatSize(bucket)).fill(0), found: zeroFound() };
}

const isEmpty = (values: WorkspaceValues) =>
  WORKSPACE_COUNTERS.every((c) => values[c] === 0) &&
  values.heat.every((n) => n === 0) &&
  RARITIES.every((r) => values.found[r] === 0);

const sameValues = (row: Doc<"workspaceStats">, values: WorkspaceValues) =>
  WORKSPACE_COUNTERS.every((c) => row[c] === values[c]) &&
  row.heat.length === values.heat.length &&
  row.heat.every((n, i) => n === values.heat[i]) &&
  RARITIES.every((r) => row.found[r] === values.found[r]);

/** The bucket's row; duplicates (which only corruption can create) are deleted, keeping any marker. */
async function workspaceRow(ctx: MutationCtx, workspaceId: Id<"workspaces">, bucket: string) {
  const rows = await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId).eq("bucket", bucket))
    .collect();
  const keep = rows.find((r) => r.rollupsBackfilledAt !== undefined) ?? rows[0] ?? null;
  for (const r of rows) if (r !== keep) await ctx.db.delete(r._id);
  return keep;
}

async function writeWorkspaceRow(ctx: MutationCtx, workspaceId: Id<"workspaces">, bucket: string, values: WorkspaceValues) {
  const row = await workspaceRow(ctx, workspaceId, bucket);
  if (!row) {
    if (!isEmpty(values)) await ctx.db.insert("workspaceStats", { workspaceId, bucket, ...values });
  } else if (isEmpty(values) && row.rollupsBackfilledAt === undefined) {
    await ctx.db.delete(row._id);
  } else if (!sameValues(row, values)) {
    await ctx.db.patch(row._id, values); // keeps the backfill marker on the `all` row
  }
}

/**
 * Make `existing` match `desired` (keyed by `keyOf`): delete rows without a desired value (and
 * duplicates), then upsert the rest. Desired values must all be non-zero.
 */
async function syncRows<R extends { _id: Id<TableNames> }, V>(
  ctx: MutationCtx,
  existing: R[],
  keyOf: (row: R) => string,
  desired: Map<string, V>,
  upsert: (row: R | undefined, key: string, value: V) => Promise<unknown>,
) {
  const byKey = new Map<string, R>();
  for (const row of existing) {
    const key = keyOf(row);
    if (!desired.has(key) || byKey.has(key)) await ctx.db.delete(row._id);
    else byKey.set(key, row);
  }
  for (const [key, value] of desired) await upsert(byKey.get(key), key, value);
}

const add = (m: Map<string, number>, key: string, n: number) => m.set(key, (m.get(key) ?? 0) + n);
const positive = (m: Map<string, number>) => new Map([...m].filter(([, n]) => n !== 0));

/**
 * `at` bounds for rows whose `dayKey` lies in [from, to]: a day key is the local date in some
 * timezone (UTC−12 … UTC+14) at write time, so `at` is within a day of that date's UTC midnight.
 * Callers filter on `dayKey`.
 */
function atWindow(from: string, to: string) {
  return { lo: Date.parse(`${from}T00:00:00Z`) - DAY_MS, hi: Date.parse(`${to}T00:00:00Z`) + 2 * DAY_MS };
}

async function kudosOnDays(ctx: QueryCtx, workspaceId: Id<"workspaces">, from: string, to: string) {
  const { lo, hi } = atWindow(from, to);
  const rows: Doc<"kudos">[] = [];
  const range = ctx.db
    .query("kudos")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId).gte("at", lo).lt("at", hi));
  for await (const k of range) if (k.dayKey >= from && k.dayKey <= to) rows.push(k);
  return rows;
}

async function kudosGivenOnDays(ctx: QueryCtx, giverId: Id<"members">, from: string, to: string) {
  const { lo, hi } = atWindow(from, to);
  const rows: Doc<"kudos">[] = [];
  const range = ctx.db.query("kudos").withIndex("by_giver_at", (q) => q.eq("giverId", giverId).gte("at", lo).lt("at", hi));
  for await (const k of range) if (k.dayKey >= from && k.dayKey <= to) rows.push(k);
  return rows;
}

/** The kudos row's local hour, as the live maintenance uses it (stored, else from `at` now). */
const hourOf = (k: Doc<"kudos">, workspace: Workspace) => k.hour ?? zonedParts(k.at, workspace.timezone).hour;

/** A `memberDays` row's allowance use: stored, else capped at today's limit (rows from before rollups). */
const cappedOf = (d: Doc<"memberDays">, workspace: Workspace) => d.capped ?? Math.min(d.given, workspace.dailyLimit);

// ---------------------------------------------------------------------------------------------
// Workspace day: `workspaceStats d:<day>` from that day's memberDays, kudos and first discoveries.

export async function rebuildWorkspaceDay(ctx: MutationCtx, workspace: Workspace, dayKey: string) {
  const bucket = dayBucket(dayKey);
  const values = emptyValues(bucket);
  const days = await ctx.db
    .query("memberDays")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspace._id).eq("dayKey", dayKey))
    .collect(); // one row per member active that day
  for (const d of days) {
    const capped = cappedOf(d, workspace);
    // Pin the cap and hour on legacy rows, so later limit or timezone changes can't move them.
    if (d.capped === undefined) await ctx.db.patch(d._id, { capped });
    if (d.given > 0) {
      values.givers += 1;
      values.giverDays += 1;
    }
    if (d.received > 0) values.receivers += 1;
    if (d.maxed) values.maxedDays += 1;
    values.cappedGiven += capped;
  }
  const batches = new Set<string>();
  for (const k of await kudosOnDays(ctx, workspace._id, dayKey, dayKey)) {
    const hour = hourOf(k, workspace);
    if (k.hour === undefined) await ctx.db.patch(k._id, { hour });
    values.given += k.amount;
    values.kudosRows += 1;
    if (k.source === "reaction") values.fromReactions += k.amount;
    else values.fromMessages += k.amount;
    values.heat[hour] += k.amount;
    batches.add(k.batchId);
  }
  values.messages = batches.size;
  // Discoveries carry no day key: their day is taken in the current timezone.
  const firstSeen = ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) =>
      q
        .eq("workspaceId", workspace._id)
        .gte("firstSeenAt", startOfDayUtc(dayKey, workspace.timezone))
        .lt("firstSeenAt", startOfDayUtc(addDays(dayKey, 1), workspace.timezone)),
    );
  for await (const found of firstSeen) values.found[found.rarity] += 1;
  await writeWorkspaceRow(ctx, workspace._id, bucket, values);
}

// ---------------------------------------------------------------------------------------------
// Member years: a member's w/m/q/y `memberStats` and a giver's w/m/q/y `pairStats` for one year.

/**
 * The days a year's member buckets cover: whole ISO weeks from the week holding January 1st to
 * the week holding December 31st. A week straddling New Year belongs to both years' units, which
 * write the same absolute values.
 */
function yearSpan(year: number) {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  return { from: addDays(first, -weekdayOfKey(first)), to: addDays(last, 6 - weekdayOfKey(last)) };
}

/** A year unit owns its m/q/y buckets and every week overlapping the year. */
function yearBuckets(year: number, dayKey: string) {
  const inYear = dayKey.startsWith(`${year}-`);
  return memberBuckets(dayKey).filter((b) => inYear || b.startsWith("w:"));
}

/** The bucket ranges a year unit owns, to find stray rows: `[prefix, exact?]`. */
function yearBucketRanges(year: number) {
  const prefixes = [`w:${year}-`, `m:${year}-`, `q:${year}-`];
  const edges = [weekBucket(`${year}-01-01`), weekBucket(`${year}-12-31`)].filter((b) => !b.startsWith(`w:${year}-`));
  return { prefixes, exact: [...new Set([...edges, `y:${year}`])] };
}

export async function rebuildMemberYear(ctx: MutationCtx, workspace: Workspace, memberId: Id<"members">, year: number) {
  const { from, to } = yearSpan(year);
  const desired = new Map<string, MemberCounts>();
  const days = ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId).gte("dayKey", from).lte("dayKey", to));
  for await (const d of days) {
    if (d.given === 0 && d.received === 0) continue;
    for (const bucket of yearBuckets(year, d.dayKey)) {
      const row = desired.get(bucket) ?? zeroMember();
      row.given += d.given;
      row.received += d.received;
      if (d.maxed) row.maxedDays += 1;
      if (d.given > 0) row.activeDays += 1;
      desired.set(bucket, row);
    }
  }
  const { prefixes, exact } = yearBucketRanges(year);
  const existing: Doc<"memberStats">[] = [];
  for (const prefix of prefixes) {
    existing.push(
      ...(await ctx.db
        .query("memberStats")
        .withIndex("by_member_bucket", (q) => q.eq("memberId", memberId).gte("bucket", prefix).lt("bucket", prefix + END))
        .collect()),
    );
  }
  for (const bucket of exact) {
    existing.push(
      ...(await ctx.db
        .query("memberStats")
        .withIndex("by_member_bucket", (q) => q.eq("memberId", memberId).eq("bucket", bucket))
        .collect()),
    );
  }
  await syncRows(ctx, existing, (r) => r.bucket, desired, async (row, bucket, counts) => {
    if (!row) await ctx.db.insert("memberStats", { workspaceId: workspace._id, memberId, bucket, ...counts });
    else if (MEMBER_COUNTERS.some((c) => row[c] !== counts[c])) await ctx.db.patch(row._id, counts);
  });
}

export async function rebuildGiverPairs(ctx: MutationCtx, workspace: Workspace, giverId: Id<"members">, year: number) {
  const { from, to } = yearSpan(year);
  const desired = new Map<string, number>();
  for (const k of await kudosGivenOnDays(ctx, giverId, from, to)) {
    for (const bucket of yearBuckets(year, k.dayKey)) add(desired, `${k.receiverId}|${bucket}`, k.amount);
  }
  const { prefixes, exact } = yearBucketRanges(year);
  const existing: Doc<"pairStats">[] = [];
  const pairRows = async (lower: string, upper: string | null) =>
    await ctx.db
      .query("pairStats")
      .withIndex("by_giver_bucket_receiver", (q) =>
        upper === null ? q.eq("giverId", giverId).eq("bucket", lower) : q.eq("giverId", giverId).gte("bucket", lower).lt("bucket", upper),
      )
      .collect();
  for (const prefix of prefixes) existing.push(...(await pairRows(prefix, prefix + END)));
  for (const bucket of exact) existing.push(...(await pairRows(bucket, null)));
  await syncRows(ctx, existing, (r) => `${r.receiverId}|${r.bucket}`, positive(desired), async (row, key, amount) => {
    const [receiverId, bucket] = key.split("|") as [Id<"members">, string];
    if (!row) await ctx.db.insert("pairStats", { workspaceId: workspace._id, bucket, giverId, receiverId, amount });
    else if (row.amount !== amount) await ctx.db.patch(row._id, { amount });
  });
}

// ---------------------------------------------------------------------------------------------
// Member all time: totals and giving profile from all their memberDays, `pairStats all` from
// their year pairs. Run after the member's year units.

export async function rebuildMemberAll(ctx: MutationCtx, workspace: Workspace, member: Doc<"members">) {
  let totalGiven = 0;
  let totalReceived = 0;
  let totalMaxedDays = 0;
  const days = ctx.db.query("memberDays").withIndex("by_member_day", (q) => q.eq("memberId", member._id));
  for await (const d of days) {
    totalGiven += d.given;
    totalReceived += d.received;
    if (d.maxed) totalMaxedDays += 1;
  }
  const patch: Partial<Doc<"members">> = {};
  if (member.totalGiven !== totalGiven) patch.totalGiven = totalGiven;
  if (member.totalReceived !== totalReceived) patch.totalReceived = totalReceived;
  if (member.totalMaxedDays !== totalMaxedDays) patch.totalMaxedDays = totalMaxedDays;
  // Members who never gave keep no profile, as with live maintenance.
  if (totalGiven > 0 || member.givenByWeekday !== undefined) {
    const profile = await recomputeGivingProfile(ctx, member._id);
    if (JSON.stringify(profile.givenByWeekday) !== JSON.stringify(member.givenByWeekday)) patch.givenByWeekday = profile.givenByWeekday;
    if (profile.currentStreak !== member.currentStreak) patch.currentStreak = profile.currentStreak;
    if (profile.longestStreak !== member.longestStreak) patch.longestStreak = profile.longestStreak;
    if (profile.lastActiveDay !== member.lastActiveDay) patch.lastActiveDay = profile.lastActiveDay;
  }
  if (Object.keys(patch).length > 0) await ctx.db.patch(member._id, patch);

  const desired = new Map<string, number>();
  const yearPairs = ctx.db
    .query("pairStats")
    .withIndex("by_giver_bucket_receiver", (q) => q.eq("giverId", member._id).gte("bucket", "y:").lt("bucket", "y:" + END));
  for await (const p of yearPairs) add(desired, p.receiverId, p.amount);
  const existing = await ctx.db
    .query("pairStats")
    .withIndex("by_giver_bucket_receiver", (q) => q.eq("giverId", member._id).eq("bucket", ALL_BUCKET))
    .collect();
  await syncRows(ctx, existing, (r) => r.receiverId, positive(desired), async (row, receiverId, amount) => {
    if (!row) {
      await ctx.db.insert("pairStats", {
        workspaceId: workspace._id,
        bucket: ALL_BUCKET,
        giverId: member._id,
        receiverId: receiverId as Id<"members">,
        amount,
      });
    } else if (row.amount !== amount) {
      await ctx.db.patch(row._id, { amount });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Workspace periods: `workspaceStats` and `channelStats` for a w/m/q/y bucket, and `all`.

/** Distinct members with a positive `memberStats` value in the bucket. */
async function countMembers(ctx: QueryCtx, workspaceId: Id<"workspaces">, bucket: string, field: "given" | "received") {
  let n = 0;
  const rows =
    field === "given"
      ? ctx.db.query("memberStats").withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspaceId).eq("bucket", bucket).gt("given", 0))
      : ctx.db.query("memberStats").withIndex("by_workspace_bucket_received", (q) => q.eq("workspaceId", workspaceId).eq("bucket", bucket).gt("received", 0));
  for await (const _ of rows) n += 1;
  return n;
}

/** Add a lower bucket row's additive counters (all but givers/receivers) into `values`. */
function addRow(values: WorkspaceValues, row: Doc<"workspaceStats">, heatOffset: number) {
  for (const c of WORKSPACE_COUNTERS) if (c !== "givers" && c !== "receivers") values[c] += row[c];
  row.heat.forEach((n, i) => (values.heat[heatOffset + i] += n));
  for (const r of RARITIES) values.found[r] += row.found[r];
}

async function channelRows(ctx: QueryCtx, workspaceId: Id<"workspaces">, lower: string, upper: string | null) {
  return await ctx.db
    .query("channelStats")
    .withIndex("by_workspace_bucket_channel", (q) =>
      upper === null
        ? q.eq("workspaceId", workspaceId).eq("bucket", lower)
        : q.eq("workspaceId", workspaceId).gte("bucket", lower).lt("bucket", upper),
    )
    .collect();
}

async function writeChannels(ctx: MutationCtx, workspaceId: Id<"workspaces">, bucket: string, desired: Map<string, number>) {
  const existing = await channelRows(ctx, workspaceId, bucket, null);
  await syncRows(ctx, existing, (r) => r.channel, positive(desired), async (row, channel, amount) => {
    if (!row) await ctx.db.insert("channelStats", { workspaceId, bucket, channel, amount });
    else if (row.amount !== amount) await ctx.db.patch(row._id, { amount });
  });
}

/**
 * A week, month, quarter or year: counters, heat and discoveries sum its day rows; givers and
 * receivers count its `memberStats` rows. Weeks and months read their kudos for channels and
 * distinct messages; quarters and years sum their months' channels and their days' messages
 * (exact because a batch is written by one give, so it never spans days).
 */
export async function rebuildWorkspacePeriod(ctx: MutationCtx, workspace: Workspace, bucket: string) {
  const { start, end } = bucketDays(bucket);
  const values = emptyValues(bucket);
  const days = ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) =>
      q.eq("workspaceId", workspace._id).gte("bucket", dayBucket(start)).lte("bucket", dayBucket(end)),
    );
  for await (const day of days) addRow(values, day, weekdayOfKey(day.bucket.slice(2)) * 24);
  values.givers = await countMembers(ctx, workspace._id, bucket, "given");
  values.receivers = await countMembers(ctx, workspace._id, bucket, "received");

  const channels = new Map<string, number>();
  if (bucket.startsWith("w:") || bucket.startsWith("m:")) {
    const batches = new Set<string>();
    for (const k of await kudosOnDays(ctx, workspace._id, start, end)) {
      add(channels, channelKey(k), k.amount);
      batches.add(k.batchId);
    }
    values.messages = batches.size;
  } else {
    const months = await channelRows(ctx, workspace._id, `m:${start.slice(0, 7)}`, `m:${end.slice(0, 7)}` + END);
    for (const c of months) add(channels, c.channel, c.amount);
  }
  await writeWorkspaceRow(ctx, workspace._id, bucket, values);
  await writeChannels(ctx, workspace._id, bucket, channels);
}

/** All time: sums of the year rows; givers and receivers from member totals, as live maintenance counts them. */
export async function rebuildWorkspaceAll(ctx: MutationCtx, workspace: Workspace) {
  const values = emptyValues(ALL_BUCKET);
  const years = ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspace._id).gte("bucket", "y:").lt("bucket", "y:" + END));
  for await (const year of years) addRow(values, year, 0);
  const members = ctx.db.query("members").withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id));
  for await (const m of members) {
    if (m.totalGiven > 0) values.givers += 1;
    if (m.totalReceived > 0) values.receivers += 1;
  }
  const channels = new Map<string, number>();
  for (const c of await channelRows(ctx, workspace._id, "y:", "y:" + END)) add(channels, c.channel, c.amount);
  await writeWorkspaceRow(ctx, workspace._id, ALL_BUCKET, values);
  await writeChannels(ctx, workspace._id, ALL_BUCKET, channels);
}

/** Record a finished backfill on the workspace's `all` row (created if the workspace has no activity). */
export async function markBackfilled(ctx: MutationCtx, workspaceId: Id<"workspaces">, at: number) {
  const row = await workspaceRow(ctx, workspaceId, ALL_BUCKET);
  if (row) await ctx.db.patch(row._id, { rollupsBackfilledAt: at });
  else await ctx.db.insert("workspaceStats", { workspaceId, bucket: ALL_BUCKET, ...emptyValues(ALL_BUCKET), rollupsBackfilledAt: at });
}

/**
 * The day range holding any source row of the workspace, or any rollup row (so stray buckets are
 * rebuilt to zero too), padded by a day each side.
 */
export async function sourceSpan(ctx: QueryCtx, workspace: Workspace, today: string) {
  const id = workspace._id;
  const edge = async (order: "asc" | "desc") => {
    const keys: string[] = [];
    const day = await ctx.db.query("memberDays").withIndex("by_workspace_day", (q) => q.eq("workspaceId", id)).order(order).first();
    if (day) keys.push(day.dayKey);
    const k = await ctx.db.query("kudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", id)).order(order).first();
    if (k) keys.push(k.dayKey);
    const found = await ctx.db.query("discoveries").withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", id)).order(order).first();
    if (found) keys.push(new Date(found.firstSeenAt).toISOString().slice(0, 10));
    for (const prefix of ["d:", "w:", "m:", "q:", "y:"]) {
      const [lo, hi] = [prefix, prefix + END];
      const rows = [
        await ctx.db
          .query("workspaceStats")
          .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", id).gte("bucket", lo).lt("bucket", hi))
          .order(order)
          .first(),
        await ctx.db
          .query("memberStats")
          .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", id).gte("bucket", lo).lt("bucket", hi))
          .order(order)
          .first(),
        await ctx.db
          .query("pairStats")
          .withIndex("by_workspace_bucket_amount", (q) => q.eq("workspaceId", id).gte("bucket", lo).lt("bucket", hi))
          .order(order)
          .first(),
        await ctx.db
          .query("channelStats")
          .withIndex("by_workspace_bucket_channel", (q) => q.eq("workspaceId", id).gte("bucket", lo).lt("bucket", hi))
          .order(order)
          .first(),
      ];
      for (const row of rows) {
        if (!row) continue;
        const { start, end } = bucketDays(row.bucket);
        keys.push(order === "asc" ? start : end);
      }
    }
    return keys;
  };
  const first = [...(await edge("asc")), today].sort()[0];
  const last = [...(await edge("desc")), today].sort().at(-1)!;
  return { from: addDays(first, -1), to: addDays(last, 1) };
}
