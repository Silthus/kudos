import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { setupConvex } from "./helpers";

/**
 * The scale-proof seed (#30) writes hundreds of fake members and tens of thousands of kudos, so it
 * must never run anywhere but a developer's local backend.
 */

let t: ReturnType<typeof setupConvex>;

beforeEach(() => {
  t = setupConvex();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function rowCounts() {
  return await t.run(async (ctx) => ({
    workspaces: (await ctx.db.query("workspaces").collect()).length,
    members: (await ctx.db.query("members").collect()).length,
    kudos: (await ctx.db.query("kudos").collect()).length,
  }));
}

describe("seedScale guard", () => {
  test.each([
    ["the production deployment", "https://valiant-monitor-701.convex.cloud"],
    ["a cloud dev deployment", "https://different-parrot-984.convex.cloud"],
    ["a look-alike host", "http://127.0.0.1.evil.example"],
    ["an unknown deployment", undefined],
  ])("refuses to run on %s and writes nothing", async (_, url) => {
    vi.stubEnv("CONVEX_CLOUD_URL", url);
    await expect(t.mutation(internal.rollups.seedScale, { members: 5, kudosPerYear: 500 })).rejects.toThrow(/local backend/);
    expect(await rowCounts()).toEqual({ workspaces: 0, members: 0, kudos: 0 });
  });
});

describe("seedScale on a local backend", () => {
  beforeEach(() => vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210"));

  const SPAN = { fromDay: "2026-06-01", toDay: "2026-09-23" }; // 115 days
  const seed = () => t.mutation(internal.rollups.seedScale, { members: 30, kudosPerYear: 3_000, ...SPAN });

  test("seeds signed-in members and a span of kudos at the requested yearly rate", async () => {
    const workspaceId = await seed();
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);

    const s = await t.run(async (ctx) => {
      const members = await ctx.db.query("members").withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId)).collect();
      const kudos = await ctx.db.query("kudos").withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId)).collect();
      const days = await ctx.db.query("memberDays").withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId)).collect();
      const users = await Promise.all(members.filter((m) => !m.isBot).map((m) => (m.userId ? ctx.db.get(m.userId) : null)));
      return { members, kudos, days, users };
    });
    const humans = s.members.filter((m) => !m.isBot);
    expect(humans).toHaveLength(30);
    expect(s.users.every((u) => u !== null)).toBe(true);
    // 3,000 a year over 115 days is ~945 rows; weekends are quiet but not empty.
    expect(s.kudos.length).toBeGreaterThan(850);
    expect(s.kudos.length).toBeLessThan(1_050);
    expect(s.kudos.every((k) => k.dayKey >= SPAN.fromDay && k.dayKey <= SPAN.toDay)).toBe(true);
    expect(new Set(s.kudos.map((k) => k.dayKey.slice(0, 7)))).toEqual(new Set(["2026-06", "2026-07", "2026-08", "2026-09"]));
    expect(s.kudos.every((k) => k.giverId !== k.receiverId)).toBe(true);
    expect(new Set(s.kudos.map((k) => k.source))).toEqual(new Set(["message", "reaction"]));

    // The sources agree with each other the way the engine keeps them.
    const sum = (rows: { amount: number }[]) => rows.reduce((n, r) => n + r.amount, 0);
    for (const m of humans) {
      const given = sum(s.kudos.filter((k) => k.giverId === m._id));
      const received = sum(s.kudos.filter((k) => k.receiverId === m._id));
      const mine = s.days.filter((d) => d.memberId === m._id);
      expect(m.totalGiven, m.name).toBe(given);
      expect(m.totalReceived, m.name).toBe(received);
      expect(mine.reduce((n, d) => n + d.given, 0), m.name).toBe(given);
      expect(mine.reduce((n, d) => n + d.received, 0), m.name).toBe(received);
      expect(m.totalMaxedDays, m.name).toBe(mine.filter((d) => d.maxed).length);
    }
    for (const d of s.days) {
      expect(d.given).toBeLessThanOrEqual(5); // the default daily limit
      expect(d.maxed).toBe(d.given >= 5);
    }
  });

  test("its rollups backfill and verify exactly", async () => {
    const workspaceId = await seed();
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    await t.mutation(internal.rollups.backfillAll, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);

    const buckets = ["d:2026-09-22", "w:2026-W38", "m:2026-06", "m:2026-08", "q:2026-Q3"];
    const result = await t.query(internal.rollups.verify, { workspaceId, buckets });
    expect(result).toEqual({ checked: buckets, mismatches: [] });
    const workspace = await t.run((ctx) => ctx.db.get(workspaceId));
    expect(workspace?.rollupsBackfilledAt).toBeDefined();
  });

  test("names the viewers the measurement signs in as: the busiest member, the median one and a teammate", async () => {
    const workspaceId = await seed();
    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    const result = await t.query(internal.rollups.seedScaleViewers, {});
    const humans = (await t.run((ctx) => ctx.db.query("members").collect())).filter((m) => !m.isBot);
    const activity = (m: { totalGiven: number; totalReceived: number }) => m.totalGiven + m.totalReceived;
    const busiest = Math.max(...humans.map(activity));

    expect(result?.workspaceId).toBe(workspaceId);
    expect(result?.members).toBe(30);
    const { heaviest, median, teammate } = result!.viewers;
    expect(activity(humans.find((m) => m._id === heaviest._id)!)).toBe(busiest);
    expect(humans.filter((m) => activity(m) < activity(humans.find((h) => h._id === median._id)!)).length).toBe(15);
    expect(teammate._id).not.toBe(heaviest._id);
    for (const v of [heaviest, median, teammate]) {
      expect(v.userId).toBe(humans.find((m) => m._id === v._id)!.userId);
    }

    vi.stubEnv("CONVEX_CLOUD_URL", "https://valiant-monitor-701.convex.cloud");
    await expect(t.query(internal.rollups.seedScaleViewers, {})).rejects.toThrow(/local backend/);
  });

  test("refuses to seed the same team twice", async () => {
    await seed();
    await expect(seed()).rejects.toThrow(/already/);
  });
});
