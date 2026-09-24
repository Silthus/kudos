import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { addDays } from "../convex/lib/time";
import { NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

// The server clock stays frozen at NOW (Wed 2026-09-23, Berlin) in every test: whatever rolls over
// does so because the client's day key changed, never because the server read the wall clock.
let t: ReturnType<typeof setupConvex>;
let team: Team;

const activity = (memberId: Id<"members">, dayKey: string, given: number, received = 0) =>
  t.run(async (ctx) => {
    await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey, given, received, maxed: false });
  });

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility: "everyone" });
});
afterEach(() => vi.useRealTimers());

describe("midnight rollover", () => {
  test("the allowance refills when the client's day rolls over, with the server clock standing still", async () => {
    await activity(team.ana, "2026-09-23", 3);
    const ana = await signInAs(t, team.ana);
    expect((await ana.query(api.me.today, { today: "2026-09-23" })).used).toBe(3);
    expect(Date.now()).toBe(NOW.getTime());
    expect(await ana.query(api.me.today, { today: "2026-09-24" })).toMatchObject({ used: 0, remaining: 5 });
  });

  test("Monday starts a fresh weekly board and week rank, with last week as the comparison", async () => {
    await activity(team.ana, "2026-09-27", 2); // Sunday
    const ana = await signInAs(t, team.ana);

    const sunday = await ana.query(api.leaderboard.get, { period: "week", metric: "given", today: "2026-09-27" });
    expect(sunday.rows.map((r) => [r.member.name, r.value])).toEqual([["Ana", 2]]);
    expect((await ana.query(api.me.overview, { period: "week", today: "2026-09-27" })).week).toMatchObject({ given: 2 });
    expect((await ana.query(api.me.standing, { period: "week", today: "2026-09-27" })).week).toEqual({ rank: 1, of: 1 });

    const monday = await ana.query(api.leaderboard.get, { period: "week", metric: "given", today: "2026-09-28" });
    expect(monday.rows).toEqual([]);
    expect(monday.range).toEqual({ start: "2026-09-28", end: "2026-09-28" });
    expect(monday.previousRange).toEqual({ start: "2026-09-21", end: "2026-09-27" });
    expect((await ana.query(api.me.overview, { period: "week", today: "2026-09-28" })).week).toMatchObject({
      given: 0,
      lastWeekGiven: 2,
      start: "2026-09-28",
    });
    expect((await ana.query(api.me.standing, { period: "week", today: "2026-09-28" })).week).toEqual({ rank: null, of: 0 });
  });
});

describe("calendar-aligned comparisons", () => {
  beforeEach(async () => {
    await activity(team.ana, "2026-08-05", 1);
    await activity(team.ana, "2026-08-28", 4); // after "August to date" on the 23rd
    await activity(team.ana, "2026-09-10", 2);
  });

  test("workspace KPIs compare with the previous month up to the same day", async () => {
    const ana = await signInAs(t, team.ana);
    const { kpis, range, label } = await ana.query(api.analytics.overview, { period: "month", today: "2026-09-23" });
    expect(label).toBe("This month");
    expect(range).toEqual({ start: "2026-09-01", end: "2026-09-23", days: 23 });
    expect([kpis.total, kpis.prevTotal]).toEqual([2, 1]);
  });

  test("leaderboard values compare with the whole previous month", async () => {
    const ana = await signInAs(t, team.ana);
    const { rows } = await ana.query(api.leaderboard.get, { period: "month", metric: "given", today: "2026-09-23" });
    expect(rows[0]).toMatchObject({ value: 2, prevValue: 5, delta: -3, rankChange: 0 });
  });

  test("the leaderboard's workspace headline compares to date, like analytics", async () => {
    const ana = await signInAs(t, team.ana);
    const { highlights } = await ana.query(api.leaderboard.get, { period: "month", metric: "given", today: "2026-09-23" });
    expect([highlights.total, highlights.prevTotal]).toEqual([2, 1]);
  });

  test("my own period total compares with the whole previous month, the daily overlay day by day", async () => {
    const ana = await signInAs(t, team.ana);
    const { period, periodLabel, cadence } = await ana.query(api.me.overview, { period: "month", today: "2026-09-23" });
    expect(periodLabel).toBe("This month");
    expect([period.given, period.prevGiven]).toEqual([2, 5]);
    // Sep 5 lines up with Aug 5; Aug 28 lies beyond today's offset and isn't overlaid.
    expect(cadence.find((d) => d.day === "2026-09-05")?.prevGiven).toBe(1);
    expect(cadence.reduce((s, d) => s + (d.prevGiven ?? 0), 0)).toBe(1);
  });
});

describe("busy previous periods", () => {
  test("the leaderboard headline still counts the previous period to date when the full period is too big to read", async () => {
    // 15 rows a day through 2025 is 5,475 rows: more than one capped read keeps (newest first).
    await t.run(async (ctx) => {
      for (let day = "2025-01-01"; day <= "2025-12-31"; day = addDays(day, 1)) {
        for (let i = 0; i < 15; i++) {
          await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId: team.ben, dayKey: day, given: 1, received: 0, maxed: false });
        }
      }
    });
    const ana = await signInAs(t, team.ana);
    const board = await ana.query(api.leaderboard.get, { period: "year", metric: "given", today: "2026-03-31" });
    expect(board.highlights.prevTotal).toBe(90 * 15); // Jan 1 – Mar 31, 2025
  });
});

describe("across the year boundary", () => {
  test("the year starts on January 1st while ISO week 53 still spans both years", async () => {
    await activity(team.ana, "2026-12-31", 3);
    await activity(team.ana, "2027-01-01", 1);
    const ana = await signInAs(t, team.ana);
    const board = (period: "week" | "year" | "quarter") =>
      ana.query(api.leaderboard.get, { period, metric: "given", today: "2027-01-02" });
    expect((await board("year")).rows[0]).toMatchObject({ value: 1, prevValue: 3 });
    expect((await board("quarter")).rows[0]).toMatchObject({ value: 1, prevValue: 3 });
    expect((await board("week")).rows[0]).toMatchObject({ value: 4 });
    const analytics = await ana.query(api.analytics.overview, { period: "year", today: "2027-01-02" });
    // 2026 to date (Jan 1–2) had nothing, so the year-over-year comparison starts from zero.
    expect([analytics.kpis.total, analytics.kpis.prevTotal]).toEqual([1, 0]);
    expect(analytics.volume.map((d) => d.day)).toEqual(["2027-01-01", "2027-01-02"]);
  });
});

describe("period arguments", () => {
  test("reject rolling windows and impossible days", async () => {
    const ana = await signInAs(t, team.ana);
    await expect(ana.query(api.leaderboard.get, { period: "30d" as "month", metric: "given", today: "2026-09-23" })).rejects.toThrow();
    await expect(ana.query(api.analytics.overview, { period: "month", today: "2026-02-30" })).rejects.toThrow(/must be a day key/);
    await expect(ana.query(api.me.today, { today: "tomorrow" })).rejects.toThrow(/must be a day key/);
  });

  test("all time has no comparison and starts at the first recorded day", async () => {
    await activity(team.ana, "2026-06-01", 2);
    const ana = await signInAs(t, team.ana);
    const analytics = await ana.query(api.analytics.overview, { period: "all", today: "2026-09-23" });
    expect(analytics).toMatchObject({ label: "All time", range: { start: "2026-06-01", end: "2026-09-23" } });
    expect(analytics.kpis.prevTotal).toBeNull();
    const board = await ana.query(api.leaderboard.get, { period: "all", metric: "given", today: "2026-09-23" });
    expect(board.previousRange).toBeNull();
  });

  test("the all-time chart counts whole months from the first recorded one, however far away today is", async () => {
    await activity(team.ana, "2026-06-01", 2);
    const ana = await signInAs(t, team.ana);
    const { volume, grain, range } = await ana.query(api.analytics.overview, { period: "all", today: "2099-12-31" });
    expect(range.start).toBe("2026-06-01");
    expect(grain).toBe("month");
    expect(volume).toHaveLength((2099 - 2026) * 12 + 7); // June 2026 through December 2099
    expect(volume[0]).toEqual({ day: "2026-06-01", total: 2, prevTotal: null });
    expect(volume.at(-1)?.day).toBe("2099-12-01");
  });
});
