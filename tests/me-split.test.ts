import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { overview } from "../convex/me";
import { addDays } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// `me` is split by what invalidates it (#29): `me.overview` holds what only the viewer's own
// activity changes, `me.standing` the workspace-relative bits (week rank, team median).

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility: "everyone" });
});
afterEach(() => vi.useRealTimers());

/**
 * A kudos row written the way pre-rollup history was (and the demo seeds it): source rows only,
 * no rollups. `rebuild()` then backfills the rollups from them.
 */
async function legacyKudos(...args: Parameters<typeof insertLegacyKudos> extends [unknown, ...infer R] ? R : never) {
  await t.run((ctx) => insertLegacyKudos(ctx, ...args));
}

async function insertLegacyKudos(
  ctx: MutationCtx,
  giverId: Id<"members">,
  receiverId: Id<"members">,
  dayKey: string,
  { amount = 1, channel = "general", text = "thanks" }: { amount?: number; channel?: string; text?: string } = {},
) {
  const at = Date.parse(`${dayKey}T09:00:00Z`); // 11:00 in Berlin, the same day
  await ctx.db.insert("kudos", {
    workspaceId: team.workspaceId,
    batchId: `${giverId}-${at}-${receiverId}`,
    giverId,
    receiverId,
    amount,
    dayKey,
    source: "message",
    channelId: `C${channel.toUpperCase()}`,
    channelName: channel,
    text,
    at,
  });
  const bump = async (memberId: Id<"members">, field: "given" | "received") => {
    const row = await ctx.db
      .query("memberDays")
      .withIndex("by_member_day", (q) => q.eq("memberId", memberId).eq("dayKey", dayKey))
      .unique();
    if (row) await ctx.db.patch(row._id, { [field]: row[field] + amount });
    else
      await ctx.db.insert("memberDays", {
        workspaceId: team.workspaceId,
        memberId,
        dayKey,
        given: field === "given" ? amount : 0,
        received: field === "received" ? amount : 0,
        maxed: false,
      });
    const m = (await ctx.db.get(memberId))!;
    if (field === "given") await ctx.db.patch(memberId, { totalGiven: m.totalGiven + amount, lastGivenAt: at });
    else await ctx.db.patch(memberId, { totalReceived: m.totalReceived + amount });
  };
  await bump(giverId, "given");
  await bump(receiverId, "received");
}

async function rebuild() {
  await t.mutation(internal.rollups.rebuildWorkspace, { workspaceId: team.workspaceId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
}

/** Ana, Ben and Cleo over late August and September 2026 (TODAY is Wed 2026-09-23). */
async function smallHistory() {
  await legacyKudos(team.ana, team.ben, "2026-08-20", { amount: 2 });
  await legacyKudos(team.ben, team.ana, "2026-08-21", { channel: "design" });
  await legacyKudos(team.ana, team.cleo, "2026-09-01", { channel: "random" });
  await legacyKudos(team.ana, team.ben, "2026-09-21", { amount: 3 });
  await legacyKudos(team.ana, team.cleo, "2026-09-22");
  await legacyKudos(team.ana, team.cleo, "2026-09-23");
  await legacyKudos(team.ben, team.ana, "2026-09-22", { amount: 2, channel: "design" });
  await legacyKudos(team.cleo, team.ana, "2026-09-23");
  await legacyKudos(team.ben, team.cleo, "2026-09-21", { amount: 4 });
  await legacyKudos(team.cleo, team.ben, "2026-09-10");
}

describe("me.standing: week rank and team median", () => {
  test("ranks me among this week's givers and gives the team median for the period", async () => {
    await smallHistory();
    await rebuild();
    const ana = await signInAs(t, team.ana);
    // This week (Mon 21 – Wed 23): Ana 5, Ben 6, Cleo 1.
    expect(await ana.query(api.me.standing, { period: "week", today: TODAY })).toEqual({
      week: { rank: 2, of: 3 },
      teamMedian: 5,
    });
    // September: Ana 6, Ben 6, Cleo 2 → median 6. August: Ana 2, Ben 1.
    expect((await ana.query(api.me.standing, { period: "month", today: TODAY })).teamMedian).toBe(6);
    expect((await ana.query(api.me.standing, { period: "all", today: TODAY })).teamMedian).toBe(7);
  });

  test("is the same before the backfill (legacy scan) and after it (rollups)", async () => {
    await smallHistory();
    const ana = await signInAs(t, team.ana);
    const periods = ["week", "month", "quarter", "year", "all"] as const;
    const before = await Promise.all(periods.map((period) => ana.query(api.me.standing, { period, today: TODAY })));
    await rebuild();
    const after = await Promise.all(periods.map((period) => ana.query(api.me.standing, { period, today: TODAY })));
    expect(after).toEqual(before);
  });

  test("a viewer who hasn't given this week has no rank", async () => {
    await smallHistory();
    await rebuild();
    const cleo = await signInAs(t, team.cleo);
    expect((await cleo.query(api.me.standing, { period: "week", today: "2026-09-28" })).week).toEqual({ rank: null, of: 0 });
    // In the week of TODAY, Cleo gave the least.
    expect((await cleo.query(api.me.standing, { period: "week", today: TODAY })).week).toEqual({ rank: 3, of: 3 });
  });
});

describe("me.overview: the personal parts", () => {
  test("patterns, streaks and totals on a small history", async () => {
    await smallHistory();
    const ana = await signInAs(t, team.ana);
    const month = await ana.query(api.me.overview, { period: "month", today: TODAY });
    expect(month.period).toEqual({ given: 6, prevGiven: 2, received: 3 });
    // Ben and Cleo both got 3 this month: ties go to the name that sorts first.
    expect(month.patterns).toEqual({
      teammatesCelebrated: 2,
      channelsVisited: 2,
      longestStreak: 3,
      currentStreak: 3,
      bestWeekday: "Monday",
      topRecipient: { name: "Ben", amount: 3 },
      topSupporter: { name: "Ben", amount: 2 },
    });
    const all = await ana.query(api.me.overview, { period: "all", today: TODAY });
    expect(all.period).toEqual({ given: 8, prevGiven: null, received: 4 });
    expect(all.patterns).toMatchObject({
      teammatesCelebrated: 2,
      channelsVisited: 2,
      topRecipient: { name: "Ben", amount: 5 },
      topSupporter: { name: "Ben", amount: 3 },
    });
    expect(all.cadence[0].day).toBe("2026-08-20");
    const week = await ana.query(api.me.overview, { period: "week", today: TODAY });
    expect(week.week).toEqual({ given: 5, lastWeekGiven: 0, start: "2026-09-21", end: "2026-09-27" });
    expect(week.patterns).toMatchObject({ teammatesCelebrated: 2, channelsVisited: 1, topRecipient: { name: "Ben", amount: 3 } });
  });

  test.each(["everyone", "self", "hidden"] as const)(
    "is exactly the legacy result once the rollups are backfilled (%s)",
    async (receivedVisibility) => {
      await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility }));
      await smallHistory();
      const ana = await signInAs(t, team.ana);
      const legacy = await Promise.all(PERIODS.map((period) => ana.query(api.me.overview, { period, today: TODAY })));
      await rebuild();
      const rollups = await Promise.all(PERIODS.map((period) => ana.query(api.me.overview, { period, today: TODAY })));
      expect(rollups).toEqual(legacy);
      const hidden = receivedVisibility === "hidden";
      for (const r of rollups) {
        expect(r.patterns.topSupporter === null).toBe(hidden);
        expect(r.period.received === null).toBe(hidden);
      }
    },
  );

  test("reads only the viewer's own documents, and the same ones however busy everyone else is", async () => {
    await smallHistory();
    await rebuild();
    const ana = await signInAs(t, team.ana);
    const quiet = await Promise.all(PERIODS.map((period) => readsOf(ana, period)));

    // Twenty more teammates who only recognize each other, every day for two months.
    const others = await t.run(async (ctx) =>
      Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          ctx.db.insert("members", {
            workspaceId: team.workspaceId,
            slackUserId: `U${i}`,
            name: `Teammate ${i}`,
            isAdmin: false,
            isBot: false,
            deactivated: false,
            totalGiven: 0,
            totalReceived: 0,
            totalMaxedDays: 0,
          }),
        ),
      ),
    );
    await t.run(async (ctx) => {
      for (let day = "2026-07-25"; day <= TODAY; day = addDays(day, 1)) {
        for (let i = 0; i < others.length; i++) {
          await insertLegacyKudos(ctx, others[i], others[(i + 1) % others.length], day, { amount: 3, channel: `team${i}` });
        }
        await insertLegacyKudos(ctx, team.ben, team.cleo, day, { amount: 2 });
      }
    });
    await rebuild();
    const busy = await Promise.all(PERIODS.map((period) => readsOf(ana, period)));

    for (const [i, period] of PERIODS.entries()) {
      expect(busy[i].result, period).toEqual(quiet[i].result);
      expect(busy[i].reads, period).toBe(quiet[i].reads);
      const own = ownedBy(team.ana, team.workspaceId, busy[i].seen);
      expect(busy[i].seen.filter((doc) => !own(doc)), period).toEqual([]);
      // Patterns come from the viewer's own pair rollups once they are backfilled.
      expect(busy[i].seen.some((doc) => "bucket" in doc && "giverId" in doc), period).toBe(true);
    }
  }, 60_000);
});

describe("the backfill marker on the workspace", () => {
  // `me.overview` must not read the `all` workspaceStats row (every give patches it), so the
  // backfill mirrors its marker onto the workspace document.
  const marker = (workspaceId: Id<"workspaces">) => t.run(async (ctx) => (await ctx.db.get(workspaceId))?.rollupsBackfilledAt ?? null);

  test("a finished backfill marks the workspace as well as its `all` row", async () => {
    await smallHistory();
    expect(await marker(team.workspaceId)).toBeNull();
    await rebuild();
    const all = await t.run((ctx) =>
      ctx.db
        .query("workspaceStats")
        .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", team.workspaceId).eq("bucket", "all"))
        .unique(),
    );
    expect(await marker(team.workspaceId)).toBe(all?.rollupsBackfilledAt);
    expect(all?.rollupsBackfilledAt).toBeTypeOf("number");
  });

  test("a demo reset clears it until the reset's own rebuild finishes", async () => {
    const demo = await seedTeam(t, { isDemo: true, rollupsBackfilledAt: 1 }, "T_DEMO_LUMEN");
    await t.mutation(internal.demo.startDemoReset, {});
    expect(await marker(demo.workspaceId)).toBeNull();
  });
});

describe("me.overview: long histories", () => {
  test("more than 2,000 days of giving keep the newest days in the chart, streaks and totals", async () => {
    // Every day for 2,200 days up to TODAY (1 a day, 3 today), written before rollups existed.
    const first = addDays(TODAY, -2199);
    await t.run(async (ctx) => {
      for (let day = first; day <= TODAY; day = addDays(day, 1)) {
        const given = day === TODAY ? 3 : 1;
        await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: team.ana, dayKey: day, given, received: 0, maxed: false });
      }
      await ctx.db.patch(team.ana, { totalGiven: 2202 });
    });
    const ana = await signInAs(t, team.ana);

    const all = await ana.query(api.me.overview, { period: "all", today: TODAY });
    expect(all.cadence).toHaveLength(366);
    expect(all.cadence[0].day).toBe(addDays(TODAY, -365));
    expect(all.cadence.at(-1)).toMatchObject({ day: TODAY, given: 3 });
    expect(all.period.given).toBe(2202);
    expect(all.patterns).toMatchObject({ longestStreak: 2200, currentStreak: 2200 });

    const year = await ana.query(api.me.overview, { period: "year", today: TODAY });
    expect(year.period).toMatchObject({ given: 266 + 2, prevGiven: 365 }); // 266 days: Jan 1 – Sep 23, 2026
    expect(year.week).toMatchObject({ given: 5, lastWeekGiven: 7 });
  });
});

const PERIODS = ["week", "month", "quarter", "year", "all"] as const;

type Signed = Awaited<ReturnType<typeof signInAs>>;
type AnyDoc = Record<string, unknown> & { _id: string };

/** Runs `me.overview` for `viewer` with every document it reads recorded. */
async function readsOf(viewer: Signed, period: (typeof PERIODS)[number]) {
  return await viewer.run(async (ctx) => {
    const seen: AnyDoc[] = [];
    const handler = (overview as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
    const result = await handler({ ...ctx, db: recordingDb(ctx.db, seen) }, { period, today: TODAY });
    return { result, seen, reads: seen.length };
  });
}

/** Wraps a database reader so every document a query or get returns lands in `seen`. */
function recordingDb<T extends object>(db: T, seen: AnyDoc[]): T {
  const record = (value: unknown) => {
    if (Array.isArray(value)) for (const v of value) record(v);
    else if (value && typeof value === "object" && "_id" in value) seen.push(value as AnyDoc);
    else if (value && typeof value === "object" && "page" in value) record((value as { page: unknown }).page);
  };
  const wrap = <Q extends object>(target: Q): Q =>
    new Proxy(target, {
      get(obj, prop) {
        if (prop === Symbol.asyncIterator) {
          return async function* () {
            for await (const doc of obj as AsyncIterable<unknown>) {
              record(doc);
              yield doc;
            }
          };
        }
        const value = Reflect.get(obj, prop, obj);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const out = value.apply(obj, args);
          if (out instanceof Promise) return out.then((r) => (record(r), r));
          return out && typeof out === "object" ? wrap(out) : out;
        };
      },
    });
  return wrap(db);
}

/**
 * The viewer's own documents: their member and workspace, rows keyed by them (days, rollups,
 * discoveries, notifications, kudos they gave or got) and the teammates those rows name.
 */
function ownedBy(memberId: Id<"members">, workspaceId: Id<"workspaces">, seen: AnyDoc[]) {
  const counterparts = new Set<unknown>();
  for (const doc of seen) {
    if (doc.giverId === memberId) counterparts.add(doc.receiverId);
    if (doc.receiverId === memberId) counterparts.add(doc.giverId);
  }
  return (doc: AnyDoc) =>
    doc._id === memberId ||
    doc._id === workspaceId ||
    doc.memberId === memberId ||
    doc.giverId === memberId ||
    doc.receiverId === memberId ||
    counterparts.has(doc._id);
}
