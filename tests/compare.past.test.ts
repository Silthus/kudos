import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { startOfDayUtc } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

// NOW is Wed 2026-09-23 in Berlin: "week" is Mon 21 – Wed 23, and its previous week to date Mon 14 – Wed 16.
let t: ReturnType<typeof setupConvex>;
let team: Team;

async function setup(receivedVisibility: Doc<"workspaces">["receivedVisibility"] = "everyone") {
  t = setupConvex();
  team = await seedTeam(t, { receivedVisibility });
}
afterEach(() => vi.useRealTimers());

const day = (memberId: Id<"members">, dayKey: string, given: number, received = 0, maxed = false) =>
  t.run(async (ctx) => {
    await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey, given, received, maxed });
  });

const kudos = (giverId: Id<"members">, receiverId: Id<"members">, dayKey: string, channelId: string, channelName?: string) =>
  t.run(async (ctx) => {
    await ctx.db.insert("kudos", {
      workspaceId: team.workspaceId,
      batchId: `${giverId}-${dayKey}-${channelId}-${Math.random()}`,
      giverId,
      receiverId,
      amount: 1,
      dayKey,
      source: "message",
      channelId,
      channelName,
      text: "thanks for the help with the release",
      at: startOfDayUtc(dayKey, "Europe/Berlin") + 12 * 3_600_000,
    });
  });

const discovery = (memberId: Id<"members">, templateKey: string, dayKey: string) =>
  t.run(async (ctx) => {
    const at = startOfDayUtc(dayKey, "Europe/Berlin") + 9 * 3_600_000;
    await ctx.db.insert("discoveries", {
      workspaceId: team.workspaceId,
      memberId,
      templateKey,
      rarity: "common",
      category: "giver_success",
      timesSeen: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    });
  });

/** A member since January: activity long before any range under test. */
const longtime = (memberId: Id<"members">) => day(memberId, "2026-01-05", 1);

type Result = Awaited<ReturnType<typeof getPast>>;
async function getPast(period: "week" | "month" | "quarter" | "year" = "week", memberId = team.ana) {
  const viewer = await signInAs(t, memberId);
  return await viewer.query(api.compare.past.get, { period, today: TODAY });
}
const row = (r: Result, metric: string) => r.rows.find((x) => x.metric === metric)!;

describe("compare.past.get", () => {
  test("signed out", async () => {
    await setup();
    await expect(t.query(api.compare.past.get, { period: "month", today: TODAY })).rejects.toThrow("Sign in with Slack to continue.");
  });

  test("rejects a malformed today", async () => {
    await setup();
    const ana = await signInAs(t, team.ana);
    await expect(ana.query(api.compare.past.get, { period: "month", today: "2026-02-30" })).rejects.toThrow(/today/);
  });

  test("on a Wednesday, week compares Mon–Wed with last Mon–Wed", async () => {
    await setup();
    await day(team.ana, "2026-09-14", 2); // Mon, previous week
    await day(team.ana, "2026-09-16", 1, 0, true); // Wed, previous week
    await day(team.ana, "2026-09-17", 4); // Thu, previous week: after "to date"
    await day(team.ana, "2026-09-21", 3); // Mon
    await day(team.ana, "2026-09-22", 5, 0, true); // Tue
    await day(team.ana, "2026-09-23", 1); // Wed
    await day(team.ben, "2026-09-22", 5); // someone else's giving never counts

    const r = await getPast("week");
    expect(r.range).toEqual({ start: "2026-09-21", end: "2026-09-23", days: 3 });
    expect(r.benchmarkRange).toEqual({ start: "2026-09-14", end: "2026-09-16", days: 3 });
    expect(r.benchmarkNote).toBeNull();
    expect(row(r, "given")).toMatchObject({ family: "giving", you: { value: 9, locked: null }, benchmark: { value: 3, locked: null }, delta: 6 });
    expect(row(r, "activeDays")).toMatchObject({ you: { value: 3 }, benchmark: { value: 2 } });
    expect(row(r, "maxedDays")).toMatchObject({ you: { value: 1 }, benchmark: { value: 1 }, delta: 0 });
    expect(row(r, "longestStreak")).toMatchObject({ you: { value: 3 }, benchmark: { value: 1 } });
  });

  test("the race runs over the whole week: you up to today, last week in full", async () => {
    await setup();
    await day(team.ana, "2026-09-14", 2);
    await day(team.ana, "2026-09-17", 4);
    await day(team.ana, "2026-09-20", 1);
    await day(team.ana, "2026-09-21", 3);
    await day(team.ana, "2026-09-23", 1);

    const { race } = await getPast("week");
    expect(race.days).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(race.previousDays[0]).toBe("2026-09-14");
    expect(race.you.given).toEqual([3, 3, 4, null, null, null, null]);
    expect(race.benchmark.given).toEqual([2, 2, 2, 6, 6, 6, 7]);
  });

  test("month is this month to date against last month to date", async () => {
    await setup();
    await day(team.ana, "2026-08-05", 1);
    await day(team.ana, "2026-08-28", 4); // after August 23rd
    await day(team.ana, "2026-09-10", 2);

    const r = await getPast("month");
    expect(r.label).toBe("This month");
    expect(r.benchmarkLabel).toBe("Last month");
    expect(r.range).toMatchObject({ start: "2026-09-01", end: "2026-09-23" });
    expect(r.benchmarkRange).toMatchObject({ start: "2026-08-01", end: "2026-08-23" });
    expect(row(r, "given")).toMatchObject({ you: { value: 2 }, benchmark: { value: 1 } });
    expect(r.previousTotal.given).toBe(5);
    expect(r.race.days).toHaveLength(30);
  });

  test("reach and channels count distinct teammates and channel ids in each range", async () => {
    await setup();
    await longtime(team.ana);
    await kudos(team.ana, team.ben, "2026-09-15", "C1", "general");
    await kudos(team.ana, team.ben, "2026-09-21", "C1", "general");
    await kudos(team.ana, team.ben, "2026-09-22", "C1", "town-square"); // renamed
    await kudos(team.ana, team.cleo, "2026-09-23", "C2", "design");
    await kudos(team.ben, team.cleo, "2026-09-23", "C3", "random"); // not Ana's

    const r = await getPast("week");
    expect(row(r, "reach")).toMatchObject({ you: { value: 2 }, benchmark: { value: 1 } });
    expect(row(r, "channels")).toMatchObject({ you: { value: 2 }, benchmark: { value: 1 } });
    expect(r.truncated).toBe(false);
  });

  test("new discoveries count messages first seen in each range", async () => {
    await setup();
    await longtime(team.ana);
    await discovery(team.ana, "a", "2026-09-10"); // before both ranges
    await discovery(team.ana, "b", "2026-09-15");
    await discovery(team.ana, "c", "2026-09-21");
    await discovery(team.ana, "d", "2026-09-23");
    await discovery(team.ben, "e", "2026-09-23");

    const r = await getPast("week");
    expect(row(r, "newDiscoveries")).toMatchObject({ family: "receiving", you: { value: 2 }, benchmark: { value: 1 }, delta: 1 });
  });

  describe("received follows receivedVisibility", () => {
    const seed = async () => {
      await day(team.ana, "2026-09-15", 0, 3);
      await day(team.ana, "2026-09-22", 1, 4);
      await discovery(team.ana, "b", "2026-09-22");
    };

    test("hidden: locked on both sides, never sent; your own discoveries stay visible", async () => {
      await setup("hidden");
      await seed();
      const r = await getPast("week");
      expect(row(r, "received")).toEqual({
        metric: "received",
        family: "receiving",
        you: { value: null, locked: "hidden" },
        benchmark: { value: null, locked: "hidden" },
        delta: null,
      });
      expect(r.race.you.received).toBeNull();
      expect(r.race.benchmark.received).toBeNull();
      expect(r.previousTotal.received).toBeNull();
      expect(row(r, "newDiscoveries")).toMatchObject({ you: { value: 1, locked: null } });
    });

    for (const visibility of ["self", "everyone"] as const) {
      test(`${visibility}: your own received is yours to compare`, async () => {
        await setup(visibility);
        await seed();
        const r = await getPast("week");
        expect(row(r, "received")).toMatchObject({ you: { value: 4, locked: null }, benchmark: { value: 3, locked: null }, delta: 1 });
        expect(r.race.you.received).toEqual([0, 4, 4, null, null, null, null]);
        expect(r.race.benchmark.received?.slice(0, 3)).toEqual([0, 3, 3]);
      });
    }
  });

  test("joined after the previous period: the benchmark is empty, not zero", async () => {
    await setup();
    await day(team.ben, "2026-09-22", 2); // Ben was created today and has no earlier activity
    const r = await getPast("week", team.ben);
    expect(r.benchmarkNote).toBe("notMember");
    expect(r.joinedOn).toBe(TODAY);
    expect(row(r, "given")).toMatchObject({ you: { value: 2 }, benchmark: { value: null, locked: null }, delta: null });
    expect(r.race.benchmark.given).toBeNull();
    expect(r.previousTotal.given).toBeNull();
  });

  test("earlier activity proves membership even when the member row is newer (e.g. back-dated history)", async () => {
    await setup();
    await day(team.ana, "2026-08-02", 1); // long before last week
    const r = await getPast("week");
    expect(r.benchmarkNote).toBeNull();
    expect(row(r, "given")).toMatchObject({ you: { value: 0 }, benchmark: { value: 0 } });
  });

  test("only the viewer's own workspace and rows", async () => {
    await setup();
    const other = await seedTeam(t, {}, "T2");
    await t.run(async (ctx) => {
      await ctx.db.insert("memberDays", { workspaceId: other.workspaceId, memberId: other.ana, dayKey: "2026-09-22", given: 5, received: 0, maxed: true });
    });
    await day(team.ana, "2026-09-01", 1);
    const r = await getPast("week");
    expect(row(r, "given").you.value).toBe(0);
  });
});
