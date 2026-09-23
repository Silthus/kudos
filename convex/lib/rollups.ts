import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { RARITIES, type Rarity } from "./messages";
import { dayBucket, heatIndex, heatSize, memberBuckets, pairBuckets, workspaceBuckets, ALL_BUCKET } from "./buckets";
import { daysBetween, weekdayOfKey, zonedParts } from "./time";

/**
 * Exact read-model maintenance. The engine reports every change to `kudos`, `memberDays`,
 * member totals and discoveries to one `Rollups` accumulator per transaction, then calls
 * `flush()` once: each touched rollup row is read and written at most once.
 *
 * Distinct counters (givers, receivers, giverDays, activeDays, maxedDays, messages) only move
 * on 0 ↔ >0 transitions of the row they count, so give followed by revoke returns every
 * rollup to zero. Rows are created lazily from the first delta and deleted when they reach
 * all zeros; counters never go below zero (a revoke of a row given before rollups existed
 * clamps instead of going negative, and the rebuild overwrites it anyway).
 */

/** The single `channelStats` key every private channel shares. */
export const PRIVATE_CHANNELS = "Private channels";

export function channelKey(row: Pick<Doc<"kudos">, "channelId" | "channelName" | "channelPrivate">) {
  return row.channelPrivate ? PRIVATE_CHANNELS : (row.channelName ?? row.channelId);
}

/** A `memberDays` row's counters; an absent row counts as all zeros. */
export type DayCounts = { given: number; received: number; maxed: boolean; capped: number };
export type MemberDayChange = { memberId: Id<"members">; dayKey: string; before: DayCounts; after: DayCounts };
export type MemberTotals = { given: number; received: number };

export type KudosRow = Pick<
  Doc<"kudos">,
  "_id" | "batchId" | "giverId" | "receiverId" | "amount" | "dayKey" | "source" | "channelId" | "channelName" | "channelPrivate" | "hour" | "at"
>;

const WORKSPACE_COUNTERS = [
  "given",
  "kudosRows",
  "messages",
  "givers",
  "receivers",
  "giverDays",
  "cappedGiven",
  "maxedDays",
  "fromReactions",
  "fromMessages",
] as const;
type WorkspaceCounter = (typeof WORKSPACE_COUNTERS)[number];
type WorkspaceDelta = { counts: Record<WorkspaceCounter, number>; heat: Map<number, number>; found: Record<Rarity, number> };

const MEMBER_COUNTERS = ["given", "received", "maxedDays", "activeDays"] as const;
type MemberCounter = (typeof MEMBER_COUNTERS)[number];
type MemberCounts = Record<MemberCounter, number>;

const zeroFound = (): Record<Rarity, number> => ({ common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 });
const zeroMember = (): MemberCounts => ({ given: 0, received: 0, maxedDays: 0, activeDays: 0 });

/** +1 when a count becomes positive, −1 when it drops back to zero. */
const presence = (before: number, after: number) => (after > 0 ? 1 : 0) - (before > 0 ? 1 : 0);
const clamp = (n: number) => Math.max(0, n);
/** A batch can't hold more rows than one Slack message has mentions. */
const MAX_BATCH_ROWS = 1000;

export class Rollups {
  private readonly workspaceDeltas = new Map<string, WorkspaceDelta>();
  private readonly memberDeltas = new Map<string, { memberId: Id<"members">; bucket: string; delta: MemberCounts }>();
  private readonly pairDeltas = new Map<string, { giverId: Id<"members">; receiverId: Id<"members">; bucket: string; amount: number }>();
  private readonly channelDeltas = new Map<string, { channel: string; bucket: string; amount: number }>();
  private readonly batches = new Map<string, { added: Set<Id<"kudos">>; removed: KudosRow[] }>();

  constructor(
    private readonly ctx: MutationCtx,
    private readonly workspace: Doc<"workspaces">,
  ) {}

  /** A kudos row was inserted (call after the insert). */
  kudosAdded(row: KudosRow) {
    this.kudosRow(row, 1);
    this.batch(row.batchId).added.add(row._id);
  }

  /** A kudos row was deleted (call after the delete). */
  kudosRemoved(row: KudosRow) {
    this.kudosRow(row, -1);
    this.batch(row.batchId).removed.push(row);
  }

  /** A `memberDays` row changed from `before` to `after`. */
  memberDayChanged({ memberId, dayKey, before, after }: MemberDayChange) {
    const giving = presence(before.given, after.given);
    const receiving = presence(before.received, after.received);
    const maxed = Number(after.maxed) - Number(before.maxed);
    const capped = after.capped - before.capped;
    for (const bucket of memberBuckets(dayKey)) {
      const delta = this.member(memberId, bucket);
      delta.given += after.given - before.given;
      delta.received += after.received - before.received;
      delta.maxedDays += maxed;
      delta.activeDays += giving;
    }
    const day = this.workspaceDelta(dayBucket(dayKey)).counts;
    day.givers += giving;
    day.receivers += receiving;
    for (const bucket of workspaceBuckets(dayKey)) {
      const counts = this.workspaceDelta(bucket).counts;
      counts.giverDays += giving;
      counts.maxedDays += maxed;
      counts.cappedGiven += capped;
    }
  }

  /** `members.totalGiven/totalReceived` changed: the per-member all-time bucket. */
  memberTotalsChanged(before: MemberTotals, after: MemberTotals) {
    const all = this.workspaceDelta(ALL_BUCKET).counts;
    all.givers += presence(before.given, after.given);
    all.receivers += presence(before.received, after.received);
  }

  /** A member saw a message template for the first time. */
  discovered(rarity: Rarity, dayKey: string) {
    for (const bucket of workspaceBuckets(dayKey)) this.workspaceDelta(bucket).found[rarity] += 1;
  }

  /** Write every accumulated delta. Call once, after all source writes of the transaction. */
  async flush() {
    await this.flushMessages();
    await this.flushMembers();
    await this.flushWorkspace();
    await this.flushPairs();
    await this.flushChannels();
  }

  private kudosRow(row: KudosRow, sign: 1 | -1) {
    const units = sign * row.amount;
    const hour = row.hour ?? zonedParts(row.at, this.workspace.timezone).hour;
    for (const bucket of workspaceBuckets(row.dayKey)) {
      const delta = this.workspaceDelta(bucket);
      delta.counts.given += units;
      delta.counts.kudosRows += sign;
      if (row.source === "reaction") delta.counts.fromReactions += units;
      else delta.counts.fromMessages += units;
      const cell = heatIndex(bucket, row.dayKey, hour);
      delta.heat.set(cell, (delta.heat.get(cell) ?? 0) + units);
    }
    const channel = channelKey(row);
    for (const bucket of pairBuckets(row.dayKey)) {
      const pairKey = `${row.giverId}|${row.receiverId}|${bucket}`;
      const pair = this.pairDeltas.get(pairKey) ?? { giverId: row.giverId, receiverId: row.receiverId, bucket, amount: 0 };
      pair.amount += units;
      this.pairDeltas.set(pairKey, pair);
      const channelKeyed = `${bucket}|${channel}`;
      const ch = this.channelDeltas.get(channelKeyed) ?? { channel, bucket, amount: 0 };
      ch.amount += units;
      this.channelDeltas.set(channelKeyed, ch);
    }
  }

  private batch(batchId: string) {
    let batch = this.batches.get(batchId);
    if (!batch) this.batches.set(batchId, (batch = { added: new Set(), removed: [] }));
    return batch;
  }

  private member(memberId: Id<"members">, bucket: string) {
    const key = `${memberId}|${bucket}`;
    let entry = this.memberDeltas.get(key);
    if (!entry) this.memberDeltas.set(key, (entry = { memberId, bucket, delta: zeroMember() }));
    return entry.delta;
  }

  private workspaceDelta(bucket: string) {
    let delta = this.workspaceDeltas.get(bucket);
    if (!delta) {
      const counts = Object.fromEntries(WORKSPACE_COUNTERS.map((c) => [c, 0])) as Record<WorkspaceCounter, number>;
      this.workspaceDeltas.set(bucket, (delta = { counts, heat: new Map(), found: zeroFound() }));
    }
    return delta;
  }

  /** `messages` counts distinct batches per bucket: compare the batch's rows before and after. */
  private async flushMessages() {
    for (const [batchId, { added, removed }] of this.batches) {
      const after = await this.ctx.db
        .query("kudos")
        .withIndex("by_batch", (q) => q.eq("batchId", batchId))
        .take(MAX_BATCH_ROWS);
      const before = [...after.filter((r) => !added.has(r._id)), ...removed];
      const bucketsOf = (rows: KudosRow[]) => new Set(rows.flatMap((r) => workspaceBuckets(r.dayKey)));
      const was = bucketsOf(before);
      const is = bucketsOf(after);
      for (const bucket of new Set([...was, ...is])) {
        this.workspaceDelta(bucket).counts.messages += Number(is.has(bucket)) - Number(was.has(bucket));
      }
    }
  }

  private async flushMembers() {
    const { db } = this.ctx;
    for (const { memberId, bucket, delta } of this.memberDeltas.values()) {
      if (MEMBER_COUNTERS.every((c) => delta[c] === 0)) continue;
      const row = await db
        .query("memberStats")
        .withIndex("by_member_bucket", (q) => q.eq("memberId", memberId).eq("bucket", bucket))
        .unique();
      const before = row ?? zeroMember();
      const after = zeroMember();
      for (const c of MEMBER_COUNTERS) after[c] = clamp(before[c] + delta[c]);
      // The member's bucket row appearing or emptying is what makes them a giver/receiver there.
      const counts = this.workspaceDelta(bucket).counts;
      counts.givers += presence(before.given, after.given);
      counts.receivers += presence(before.received, after.received);
      const empty = MEMBER_COUNTERS.every((c) => after[c] === 0);
      if (row) {
        if (empty) await db.delete(row._id);
        else await db.patch(row._id, after);
      } else if (!empty) {
        await db.insert("memberStats", { workspaceId: this.workspace._id, memberId, bucket, ...after });
      }
    }
  }

  private async flushWorkspace() {
    const { db } = this.ctx;
    for (const [bucket, delta] of this.workspaceDeltas) {
      const unchanged =
        WORKSPACE_COUNTERS.every((c) => delta.counts[c] === 0) &&
        [...delta.heat.values()].every((n) => n === 0) &&
        RARITIES.every((r) => delta.found[r] === 0);
      if (unchanged) continue;
      const row = await db
        .query("workspaceStats")
        .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", this.workspace._id).eq("bucket", bucket))
        .unique();
      const counts = Object.fromEntries(
        WORKSPACE_COUNTERS.map((c) => [c, clamp((row?.[c] ?? 0) + delta.counts[c])]),
      ) as Record<WorkspaceCounter, number>;
      const heat = row?.heat.slice() ?? new Array<number>(heatSize(bucket)).fill(0);
      for (const [cell, units] of delta.heat) heat[cell] = clamp(heat[cell] + units);
      const found = zeroFound();
      for (const r of RARITIES) found[r] = clamp((row?.found[r] ?? 0) + delta.found[r]);
      const empty =
        WORKSPACE_COUNTERS.every((c) => counts[c] === 0) && heat.every((n) => n === 0) && RARITIES.every((r) => found[r] === 0);
      if (row) {
        if (empty) await db.delete(row._id);
        else await db.patch(row._id, { ...counts, heat, found });
      } else if (!empty) {
        await db.insert("workspaceStats", { workspaceId: this.workspace._id, bucket, ...counts, heat, found });
      }
    }
  }

  private async flushPairs() {
    const { db } = this.ctx;
    for (const { giverId, receiverId, bucket, amount } of this.pairDeltas.values()) {
      if (amount === 0) continue;
      const row = await db
        .query("pairStats")
        .withIndex("by_giver_bucket_receiver", (q) => q.eq("giverId", giverId).eq("bucket", bucket).eq("receiverId", receiverId))
        .unique();
      await this.writeAmount(row, clamp((row?.amount ?? 0) + amount), () =>
        db.insert("pairStats", { workspaceId: this.workspace._id, bucket, giverId, receiverId, amount }),
      );
    }
  }

  private async flushChannels() {
    const { db } = this.ctx;
    for (const { channel, bucket, amount } of this.channelDeltas.values()) {
      if (amount === 0) continue;
      const row = await db
        .query("channelStats")
        .withIndex("by_workspace_bucket_channel", (q) =>
          q.eq("workspaceId", this.workspace._id).eq("bucket", bucket).eq("channel", channel),
        )
        .unique();
      await this.writeAmount(row, clamp((row?.amount ?? 0) + amount), () =>
        db.insert("channelStats", { workspaceId: this.workspace._id, bucket, channel, amount }),
      );
    }
  }

  private async writeAmount(
    row: Doc<"pairStats"> | Doc<"channelStats"> | null,
    amount: number,
    insert: () => Promise<unknown>,
  ) {
    if (row) {
      if (amount === 0) await this.ctx.db.delete(row._id);
      else await this.ctx.db.patch(row._id, { amount });
    } else if (amount > 0) {
      await insert();
    }
  }
}

type GivingProfile = Pick<Doc<"members">, "currentStreak" | "longestStreak" | "lastActiveDay" | "givenByWeekday">;

/**
 * The member fields to patch after one of their `memberDays` rows changed: weekday sums and
 * streaks. Extending a streak is incremental; anything else (a giving day disappearing, a day
 * before the last active one, a member without a profile yet) recomputes from `memberDays`,
 * so call it after the `memberDays` write.
 */
export async function givingProfile(
  ctx: MutationCtx,
  member: Doc<"members">,
  { dayKey, before, after }: MemberDayChange,
): Promise<GivingProfile> {
  const units = after.given - before.given;
  if (units === 0) return {};
  const last = member.lastActiveDay;
  const lostDay = before.given > 0 && after.given === 0;
  const newDay = before.given === 0 && after.given > 0;
  if (!member.givenByWeekday || lostDay || (newDay && last !== undefined && dayKey <= last)) {
    return await recomputeGivingProfile(ctx, member._id);
  }
  const givenByWeekday = member.givenByWeekday.slice();
  givenByWeekday[weekdayOfKey(dayKey)] += units;
  if (!newDay) return { givenByWeekday };
  const currentStreak = last !== undefined && daysBetween(last, dayKey) === 1 ? (member.currentStreak ?? 0) + 1 : 1;
  return {
    givenByWeekday,
    currentStreak,
    longestStreak: Math.max(member.longestStreak ?? 0, currentStreak),
    lastActiveDay: dayKey,
  };
}

async function recomputeGivingProfile(ctx: MutationCtx, memberId: Id<"members">): Promise<GivingProfile> {
  const givenByWeekday = new Array<number>(7).fill(0);
  let lastActiveDay: string | undefined;
  let run = 0;
  let longestStreak = 0;
  // One row per day the member gave or received: a few hundred a year.
  const days = ctx.db.query("memberDays").withIndex("by_member_day", (q) => q.eq("memberId", memberId));
  for await (const day of days) {
    if (day.given <= 0) continue;
    givenByWeekday[weekdayOfKey(day.dayKey)] += day.given;
    run = lastActiveDay !== undefined && daysBetween(lastActiveDay, day.dayKey) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    lastActiveDay = day.dayKey;
  }
  return { givenByWeekday, currentStreak: run, longestStreak, lastActiveDay };
}
