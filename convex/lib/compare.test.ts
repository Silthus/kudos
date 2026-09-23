import { describe, expect, test } from "vitest";
import { distribution, metricsFromDays, percentileBelow, raceAxis, reachFromKudos, rowVisibility, streaks } from "./compare";

describe("streaks", () => {
  test("longest run of consecutive active days, and the run still alive today", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10", "2026-09-22", "2026-09-23"];
    expect(streaks(days, "2026-09-23")).toEqual({ longest: 3, current: 2 });
  });

  test("a run that ended yesterday is still current; one that ended earlier is not", () => {
    expect(streaks(["2026-09-21", "2026-09-22"], "2026-09-23")).toEqual({ longest: 2, current: 2 });
    expect(streaks(["2026-09-20", "2026-09-21"], "2026-09-23")).toEqual({ longest: 2, current: 0 });
  });

  test("no active days", () => {
    expect(streaks([], "2026-09-23")).toEqual({ longest: 0, current: 0 });
  });
});

const day = (dayKey: string, given: number, received = 0, maxed = false) => ({ dayKey, given, received, maxed });

describe("metricsFromDays", () => {
  const range = { start: "2026-09-21", end: "2026-09-23", days: 3 };

  test("totals, active and maxed days, and cumulative series with one entry per day ending at the total", () => {
    const rows = [day("2026-09-21", 2, 1), day("2026-09-23", 5, 0, true), day("2026-09-22", 0, 4)];
    expect(metricsFromDays(rows, range)).toEqual({
      given: 7,
      received: 5,
      activeDays: 2,
      maxedDays: 1,
      longestStreak: 1,
      cumulativeGiven: [2, 2, 7],
      cumulativeReceived: [1, 5, 5],
    });
  });

  test("ignores rows outside the range", () => {
    const rows = [day("2026-09-20", 9, 9, true), day("2026-09-22", 1), day("2026-09-24", 9)];
    expect(metricsFromDays(rows, range)).toMatchObject({ given: 1, received: 0, activeDays: 1, maxedDays: 0, cumulativeGiven: [0, 1, 1] });
  });

  test("the longest streak is clipped to the period: a run crossing the start only counts its in-period days", () => {
    const rows = ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"].map((d) => day(d, 1));
    expect(metricsFromDays(rows, range).longestStreak).toBe(2);
  });
});

describe("reachFromKudos", () => {
  test("counts distinct receivers and distinct channel ids; a renamed channel still counts once", () => {
    const rows = [
      { receiverId: "ben", channelId: "C1", channelName: "general" },
      { receiverId: "ben", channelId: "C1", channelName: "town-square" },
      { receiverId: "cleo", channelId: "C2", channelName: "design" },
      { receiverId: "cleo", channelId: "C1", channelName: "general" },
    ];
    expect(reachFromKudos(rows)).toEqual({ reach: 2, channels: 2 });
  });

  test("no kudos", () => {
    expect(reachFromKudos([])).toEqual({ reach: 0, channels: 0 });
  });
});

describe("distribution", () => {
  test("n = 1: every statistic is the one value", () => {
    expect(distribution([4])).toEqual({ n: 1, min: 4, p25: 4, median: 4, p75: 4, max: 4 });
  });

  test("n = 2 interpolates between the two values", () => {
    expect(distribution([6, 2])).toEqual({ n: 2, min: 2, p25: 3, median: 4, p75: 5, max: 6 });
  });

  test("n = 5: quartiles ignore the outlier", () => {
    expect(distribution([100, 3, 1, 4, 2])).toEqual({ n: 5, min: 1, p25: 2, median: 3, p75: 4, max: 100 });
  });

  test("all zeros, and nobody at all", () => {
    expect(distribution([0, 0, 0])).toEqual({ n: 3, min: 0, p25: 0, median: 0, p75: 0, max: 0 });
    expect(distribution([])).toEqual({ n: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0 });
  });
});

describe("percentileBelow", () => {
  test("the share of others strictly below; ties are not 'more than'", () => {
    expect(percentileBelow(3, [1, 2, 3, 3, 5])).toBe(0.4);
  });

  test("n = 1 and n = 2", () => {
    expect(percentileBelow(5, [4])).toBe(1);
    expect(percentileBelow(4, [4, 9])).toBe(0);
  });

  test("all zeros, and nobody to compare with", () => {
    expect(percentileBelow(0, [0, 0, 0, 0, 0])).toBe(0);
    expect(percentileBelow(7, [])).toBe(0);
  });
});

describe("raceAxis", () => {
  const r = (start: string, end: string, days: number) => ({ start, end, days });

  test("same-length periods line up day by day", () => {
    const axis = raceAxis(r("2026-09-21", "2026-09-27", 7), r("2026-09-14", "2026-09-20", 7));
    expect(axis.days).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(axis.previousDays).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  });

  test("a longer previous period finishes on the last day, so its line ends at its full total", () => {
    const axis = raceAxis(r("2026-02-01", "2026-02-28", 28), r("2026-01-01", "2026-01-31", 31));
    expect(axis.days).toHaveLength(28);
    expect(axis.previousDays.slice(25)).toEqual(["2026-01-26", "2026-01-27", "2026-01-31"]);
  });

  test("a shorter previous period holds its last day", () => {
    const axis = raceAxis(r("2026-03-01", "2026-03-31", 31), r("2026-02-01", "2026-02-28", 28));
    expect(axis.previousDays.slice(26)).toEqual(["2026-02-27", "2026-02-28", "2026-02-28", "2026-02-28", "2026-02-28"]);
  });
});

describe("rowVisibility", () => {
  // Mirrors the spec's §3 matrix: received-derived rows follow receivedVisibility, and a row is shown
  // only when every subject in it is visible to the viewer. Past you only involves the viewer.
  const cases = [
    // visibility, mode,       given, received,  newDiscoveries
    ["everyone", "past",       null,  null,      null],
    ["everyone", "team",       null,  null,      null],
    ["everyone", "teammate",   null,  null,      null],
    ["self",     "past",       null,  null,      null],
    ["self",     "team",       null,  "private", "private"],
    ["self",     "teammate",   null,  "private", "private"],
    ["hidden",   "past",       null,  "hidden",  null],
    ["hidden",   "team",       null,  "hidden",  "hidden"],
    ["hidden",   "teammate",   null,  "hidden",  "hidden"],
  ] as const;

  test.each(cases)("%s / %s", (visibility, mode, given, received, newDiscoveries) => {
    expect(rowVisibility(visibility, mode, "given")).toBe(given);
    for (const metric of ["activeDays", "maxedDays", "longestStreak", "reach", "channels"] as const) {
      expect(rowVisibility(visibility, mode, metric)).toBe(given);
    }
    expect(rowVisibility(visibility, mode, "received")).toBe(received);
    expect(rowVisibility(visibility, mode, "newDiscoveries")).toBe(newDiscoveries);
  });
});
