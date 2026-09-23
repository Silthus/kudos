import { describe, expect, test } from "vitest";
import { addDays, dayKeyFor, daysBetween, resolvePeriod, startOfDayUtc, weekdayOfKey, zonedParts } from "./time";

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

describe("resolvePeriod", () => {
  const wednesday = Date.UTC(2026, 8, 23, 12);

  test("week runs Monday to today and compares with the same number of days before", () => {
    const r = resolvePeriod("week", wednesday, "UTC");
    expect(r.current).toEqual({ start: "2026-09-21", end: "2026-09-23", days: 3 });
    expect(r.previous).toEqual({ start: "2026-09-18", end: "2026-09-20", days: 3 });
  });

  test("rolling windows are inclusive of today", () => {
    const r = resolvePeriod("30d", wednesday, "UTC");
    expect(r.current).toEqual({ start: "2026-08-25", end: "2026-09-23", days: 30 });
    expect(r.previous?.end).toBe("2026-08-24");
    expect(r.previous?.days).toBe(30);
  });

  test("month starts on the first", () => {
    expect(resolvePeriod("month", wednesday, "UTC").current.start).toBe("2026-09-01");
  });

  test("all time has no comparison period", () => {
    expect(resolvePeriod("all", wednesday, "UTC").previous).toBeNull();
  });
});
