import { describe, expect, test } from "vitest";
import {
  addDays,
  bucketKeys,
  dayKeyFor,
  daysBetween,
  nextDayStartUtc,
  parseToday,
  resolvePeriod,
  startOfDayUtc,
  weekdayOfKey,
  zonedParts,
} from "./time";

describe("bucket keys", () => {
  test("are pure functions of the day key", () => {
    expect(bucketKeys("2026-09-23")).toEqual({
      day: "d:2026-09-23",
      week: "w:2026-W39",
      month: "m:2026-09",
      quarter: "q:2026-Q3",
      year: "y:2026",
      all: "all",
    });
  });

  test("weeks follow ISO numbering across the year boundary", () => {
    // Thu 2026-12-31 and Sun 2027-01-03 share ISO week 2026-W53; Mon 2027-01-04 opens 2027-W01.
    expect(bucketKeys("2026-12-31").week).toBe("w:2026-W53");
    expect(bucketKeys("2027-01-03").week).toBe("w:2026-W53");
    expect(bucketKeys("2027-01-04").week).toBe("w:2027-W01");
    // Mon 2024-12-30 already belongs to 2025-W01, while its month and year stay in 2024.
    expect(bucketKeys("2024-12-30")).toMatchObject({ week: "w:2025-W01", month: "m:2024-12", quarter: "q:2024-Q4", year: "y:2024" });
    expect(bucketKeys("2026-01-01").week).toBe("w:2026-W01");
  });
});

describe("day keys", () => {
  test("are computed in the workspace timezone", () => {
    const ts = Date.UTC(2026, 8, 23, 23, 30); // 23:30 UTC
    expect(dayKeyFor(ts, "UTC")).toBe("2026-09-23");
    expect(dayKeyFor(ts, "Europe/Berlin")).toBe("2026-09-24");
    expect(dayKeyFor(ts, "America/Los_Angeles")).toBe("2026-09-23");
  });

  test("support calendar arithmetic across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-09-01", "2026-09-30")).toBe(29);
  });

  test("know their weekday (Monday = 0)", () => {
    expect(weekdayOfKey("2026-09-21")).toBe(0);
    expect(weekdayOfKey("2026-09-27")).toBe(6);
  });
});

describe("startOfDayUtc", () => {
  test("starts the day at the first local instant when DST skips midnight", () => {
    for (const [day, tz] of [["2026-09-06", "America/Santiago"], ["2026-03-08", "America/Havana"], ["2026-03-29", "Asia/Beirut"]]) {
      const ts = startOfDayUtc(day, tz);
      expect([day, tz, dayKeyFor(ts, tz)]).toEqual([day, tz, day]);
      expect([day, tz, dayKeyFor(ts - 1, tz)]).toEqual([day, tz, addDays(day, -1)]);
    }
  });


  test("returns local midnight, including on DST change days", () => {
    for (const day of ["2026-03-29", "2026-10-25", "2026-07-01"]) {
      const ts = startOfDayUtc(day, "Europe/Berlin");
      const p = zonedParts(ts, "Europe/Berlin");
      expect([p.hour, p.minute, dayKeyFor(ts, "Europe/Berlin")]).toEqual([0, 0, day]);
      expect(dayKeyFor(ts - 1, "Europe/Berlin")).toBe(addDays(day, -1));
    }
  });
});

describe("the client's current day", () => {
  test("is accepted as a real calendar day key", () => {
    expect(parseToday("2026-09-23")).toBe("2026-09-23");
    expect(parseToday("2028-02-29")).toBe("2028-02-29");
  });

  test("is rejected when malformed, impossible or outside the supported years", () => {
    for (const bad of ["2026-9-23", "2026-02-30", "2027-02-29", "2026-13-01", "20260923", "1999-12-31", "2100-01-01", "2026-09-23T00:00", ""]) {
      expect(() => parseToday(bad), bad).toThrow(/must be a day key/);
    }
  });
});

describe("nextDayStartUtc", () => {
  test("is the next local midnight in the workspace timezone", () => {
    // 23:59:30 in Berlin (CEST, UTC+2) on 2026-09-23 → midnight is 30 s away.
    const now = Date.UTC(2026, 8, 23, 21, 59, 30);
    expect(nextDayStartUtc(now, "Europe/Berlin") - now).toBe(30_000);
    // The same instant is still mid-afternoon in Los Angeles.
    expect(dayKeyFor(nextDayStartUtc(now, "America/Los_Angeles"), "America/Los_Angeles")).toBe("2026-09-24");
  });

  test("follows DST: short and long days, and a skipped midnight", () => {
    const hour = 3_600_000;
    // Berlin's spring-forward day (2026-03-29) lasts 23 hours, its fall-back day (2026-10-25) 25.
    const springStart = startOfDayUtc("2026-03-29", "Europe/Berlin");
    expect(nextDayStartUtc(springStart, "Europe/Berlin") - springStart).toBe(23 * hour);
    const fallStart = startOfDayUtc("2026-10-25", "Europe/Berlin");
    expect(nextDayStartUtc(fallStart, "Europe/Berlin") - fallStart).toBe(25 * hour);
    // Santiago skips 00:00 on 2026-09-06 (clocks jump to 01:00): 23:30 the evening before is 30 minutes from the new day.
    const lateEvening = Date.UTC(2026, 8, 6, 3, 30); // 23:30 at UTC-4
    const next = nextDayStartUtc(lateEvening, "America/Santiago");
    expect(next - lateEvening).toBe(30 * 60_000);
    expect(dayKeyFor(next, "America/Santiago")).toBe("2026-09-06");
  });

  test("rolls over into the new year", () => {
    const newYearsEve = Date.UTC(2026, 11, 31, 22, 0); // 23:00 in Berlin (CET)
    expect(dayKeyFor(nextDayStartUtc(newYearsEve, "Europe/Berlin"), "Europe/Berlin")).toBe("2027-01-01");
    expect(nextDayStartUtc(newYearsEve, "Europe/Berlin") - newYearsEve).toBe(3_600_000);
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
