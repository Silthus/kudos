import { describe, expect, test } from "vitest";
import { demoBonusDays, demoLaunchDay, demoSeedStart, shiftMonth } from "./demoGame";
import { daysBetween, weekdayOfKey } from "./time";

describe("the demo's game timeline", () => {
  test("launched on the Monday 18 weeks before this week", () => {
    expect(demoLaunchDay("2026-09-23")).toBe("2026-05-18");
    expect(demoLaunchDay("2026-09-21")).toBe("2026-05-18");
    expect(demoLaunchDay("2026-09-27")).toBe("2026-05-18");
    expect(weekdayOfKey(demoLaunchDay("2027-01-01"))).toBe(0);
  });

  test("seeds from 1 January, or earlier to hold the launch and the three baseline months before it", () => {
    expect(demoSeedStart("2026-09-23")).toBe("2026-01-01"); // launch in May: baseline February to April
    expect(demoSeedStart("2026-12-31")).toBe("2026-01-01");
    expect(demoSeedStart("2027-01-01")).toBe("2026-05-01"); // launch 24 August 2026: baseline May to July
    expect(demoSeedStart("2026-06-15")).toBe("2025-11-01"); // launch 9 February: baseline November to January
    for (const today of ["2026-01-01", "2026-03-31", "2026-07-04", "2026-11-11"]) {
      expect(daysBetween(demoSeedStart(today), demoLaunchDay(today))).toBeGreaterThanOrEqual(89);
    }
  });

  test("shifts months across years", () => {
    expect(shiftMonth("2026-02", -3)).toBe("2025-11");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", -3)).toBe("2026-02");
  });

  test("had a bonus day at the launch and a month ago, and announced the next Friday", () => {
    expect(demoBonusDays("2026-09-23")).toEqual({ past: ["2026-05-22", "2026-08-28"], upcoming: "2026-09-25" });
    expect(demoBonusDays("2026-09-25").upcoming).toBe("2026-10-02"); // on a Friday: the next one
    expect(demoBonusDays("2026-09-26").upcoming).toBe("2026-10-02");
  });
});
