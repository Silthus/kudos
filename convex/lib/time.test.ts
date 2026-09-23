import { describe, expect, test } from "vitest";
import {
  addDays,
  dayKeyFor,
  daysBetween,
  msUntilRollover,
  nextDayStartUtc,
  parseToday,
  startOfDayUtc,
  weekdayOfKey,
  zonedParts,
} from "./time";

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

describe("msUntilRollover (the client's midnight timer)", () => {
  test("waits until the next local midnight", () => {
    const now = Date.UTC(2026, 8, 23, 21, 59, 30); // 23:59:30 in Berlin
    expect(msUntilRollover(now, "Europe/Berlin")).toBe(30_000);
  });

  test("never schedules a zero or negative delay, even around a calendar day that doesn't exist", () => {
    // Samoa skipped 2011-12-30 entirely; late on the 29th the "next day" never starts.
    const lateOn29th = Date.UTC(2011, 11, 30, 9, 30); // 23:30 at UTC-10
    expect(msUntilRollover(lateOn29th, "Pacific/Apia")).toBeGreaterThanOrEqual(1_000);
  });
});
