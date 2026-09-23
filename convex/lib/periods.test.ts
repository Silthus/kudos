import { describe, expect, test } from "vitest";
import { monthBucket, quarterBucket, weekBucket, yearBucket } from "./buckets";
import { resolvePeriod } from "./periods";

describe("period bucket keys (lib/buckets)", () => {
  test("weeks follow ISO numbering across the year boundary", () => {
    // Thu 2026-12-31 and Sun 2027-01-03 share ISO week 2026-W53; Mon 2027-01-04 opens 2027-W01.
    expect(weekBucket("2026-09-23")).toBe("w:2026-W39");
    expect(weekBucket("2026-12-31")).toBe("w:2026-W53");
    expect(weekBucket("2027-01-03")).toBe("w:2026-W53");
    expect(weekBucket("2027-01-04")).toBe("w:2027-W01");
    // Mon 2024-12-30 already belongs to 2025-W01, while its month, quarter and year stay in 2024.
    expect([weekBucket("2024-12-30"), monthBucket("2024-12-30"), quarterBucket("2024-12-30"), yearBucket("2024-12-30")]).toEqual([
      "w:2025-W01",
      "m:2024-12",
      "q:2024-Q4",
      "y:2024",
    ]);
    expect(weekBucket("2026-01-01")).toBe("w:2026-W01");
    // Other 53-week years: 2015 (ends Thu) and 2020 (leap year, ends Thu).
    expect(weekBucket("2015-12-31")).toBe("w:2015-W53");
    expect(weekBucket("2016-01-03")).toBe("w:2015-W53");
    expect(weekBucket("2016-01-04")).toBe("w:2016-W01");
    expect(weekBucket("2020-12-31")).toBe("w:2020-W53");
    expect(weekBucket("2021-01-03")).toBe("w:2020-W53");
    expect(weekBucket("2021-01-04")).toBe("w:2021-W01");
  });
});

describe("resolvePeriod", () => {
  const wednesday = "2026-09-23";
  const r = (start: string, end: string, days: number) => ({ start, end, days });

  test("week is the ISO week to date, compared with all of last week and last week to date", () => {
    expect(resolvePeriod("week", wednesday)).toEqual({
      period: "week",
      label: "This week",
      bucket: "w:2026-W39",
      current: r("2026-09-21", "2026-09-23", 3),
      currentFull: r("2026-09-21", "2026-09-27", 7),
      previousBucket: "w:2026-W38",
      previous: r("2026-09-14", "2026-09-20", 7),
      previousToDate: r("2026-09-14", "2026-09-16", 3),
    });
  });

  test("month runs from the first; the to-date comparison is clamped to a shorter previous month", () => {
    const p = resolvePeriod("month", "2026-03-31");
    expect(p).toMatchObject({ label: "This month", bucket: "m:2026-03", previousBucket: "m:2026-02" });
    expect(p.current).toEqual(r("2026-03-01", "2026-03-31", 31));
    expect(p.previous).toEqual(r("2026-02-01", "2026-02-28", 28));
    expect(p.previousToDate).toEqual(r("2026-02-01", "2026-02-28", 28));
    expect(resolvePeriod("month", "2026-03-15").previousToDate).toEqual(r("2026-02-01", "2026-02-15", 15));
  });

  test("quarter compares with the previous quarter at the same day offset", () => {
    const p = resolvePeriod("quarter", wednesday);
    expect(p).toMatchObject({ label: "This quarter", bucket: "q:2026-Q3", previousBucket: "q:2026-Q2" });
    expect(p.current).toEqual(r("2026-07-01", "2026-09-23", 85));
    expect(p.currentFull).toEqual(r("2026-07-01", "2026-09-30", 92));
    expect(p.previous).toEqual(r("2026-04-01", "2026-06-30", 91));
    expect(p.previousToDate).toEqual(r("2026-04-01", "2026-06-24", 85));
  });

  test("every period rolls back across the year boundary", () => {
    const saturday = "2027-01-02";
    expect(resolvePeriod("week", saturday)).toMatchObject({
      bucket: "w:2026-W53",
      current: r("2026-12-28", "2027-01-02", 6),
      previousBucket: "w:2026-W52",
      previous: r("2026-12-21", "2026-12-27", 7),
    });
    expect(resolvePeriod("month", saturday)).toMatchObject({ bucket: "m:2027-01", previousBucket: "m:2026-12", previous: r("2026-12-01", "2026-12-31", 31) });
    expect(resolvePeriod("quarter", saturday)).toMatchObject({ bucket: "q:2027-Q1", previousBucket: "q:2026-Q4", previous: r("2026-10-01", "2026-12-31", 92) });
    expect(resolvePeriod("year", saturday)).toMatchObject({
      label: "This year",
      bucket: "y:2027",
      current: r("2027-01-01", "2027-01-02", 2),
      previousBucket: "y:2026",
      previous: r("2026-01-01", "2026-12-31", 365),
      previousToDate: r("2026-01-01", "2026-01-02", 2),
    });
  });

  test("the last day of a leap year compares with the whole shorter year before", () => {
    const p = resolvePeriod("year", "2028-12-31");
    expect(p.current.days).toBe(366);
    expect(p.previousToDate).toEqual(r("2027-01-01", "2027-12-31", 365));
  });

  test("all time has no comparison period", () => {
    const p = resolvePeriod("all", wednesday);
    expect(p).toMatchObject({ label: "All time", bucket: "all", previousBucket: null, previous: null, previousToDate: null });
    expect(p.current.end).toBe(wednesday);
  });
});
