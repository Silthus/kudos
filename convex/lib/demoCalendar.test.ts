import { describe, expect, test } from "vitest";
import { easterSunday } from "./demoCalendar";

describe("easter sunday", () => {
  test("falls on the Western (Gregorian) date", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2038)).toBe("2038-04-25"); // the latest possible
    expect(easterSunday(2285)).toBe("2285-03-22"); // the earliest possible
  });
});
