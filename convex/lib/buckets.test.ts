import { describe, expect, test } from "vitest";
import { ALL_BUCKET, heatIndex, heatSize, memberBuckets, pairBuckets, workspaceBuckets } from "./buckets";

describe("bucket keys", () => {
  test("a day belongs to its day, ISO week, month, quarter, year and all-time buckets", () => {
    expect(workspaceBuckets("2026-09-23")).toEqual(["d:2026-09-23", "w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026", "all"]);
  });

  test("members get week, month, quarter and year buckets (days and all-time live elsewhere)", () => {
    expect(memberBuckets("2026-09-23")).toEqual(["w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026"]);
  });

  test("pairs and channels get week, month, quarter, year and all-time buckets", () => {
    expect(pairBuckets("2026-09-23")).toEqual(["w:2026-W39", "m:2026-09", "q:2026-Q3", "y:2026", ALL_BUCKET]);
  });

  test("ISO weeks start on Monday and belong to the year of their Thursday", () => {
    expect(workspaceBuckets("2026-09-21")[1]).toBe("w:2026-W39"); // Monday
    expect(workspaceBuckets("2026-09-27")[1]).toBe("w:2026-W39"); // Sunday
    expect(workspaceBuckets("2026-09-28")[1]).toBe("w:2026-W40");
    // 2026 has 53 ISO weeks: Jan 1, 2027 (a Friday) is still in 2026-W53 but in the 2027 year bucket.
    expect(workspaceBuckets("2027-01-01")).toEqual(["d:2027-01-01", "w:2026-W53", "m:2027-01", "q:2027-Q1", "y:2027", "all"]);
    expect(workspaceBuckets("2027-01-04")[1]).toBe("w:2027-W01");
    // Dec 29, 2025 (a Monday) already belongs to 2026-W01.
    expect(workspaceBuckets("2025-12-29")[1]).toBe("w:2026-W01");
    expect(workspaceBuckets("2025-12-28")[1]).toBe("w:2025-W52");
  });

  test("quarters split the year in four", () => {
    expect(memberBuckets("2026-01-01")[2]).toBe("q:2026-Q1");
    expect(memberBuckets("2026-03-31")[2]).toBe("q:2026-Q1");
    expect(memberBuckets("2026-04-01")[2]).toBe("q:2026-Q2");
    expect(memberBuckets("2026-12-31")[2]).toBe("q:2026-Q4");
  });
});

describe("heatmap cells", () => {
  test("day buckets hold 24 hours", () => {
    expect(heatSize("d:2026-09-23")).toBe(24);
    expect(heatIndex("d:2026-09-23", "2026-09-23", 14)).toBe(14);
  });

  test("period buckets hold a weekday × hour grid, Monday first", () => {
    expect(heatSize("w:2026-W39")).toBe(168);
    expect(heatSize(ALL_BUCKET)).toBe(168);
    expect(heatIndex("m:2026-09", "2026-09-21", 0)).toBe(0); // Monday 00:00
    expect(heatIndex("m:2026-09", "2026-09-23", 14)).toBe(2 * 24 + 14); // Wednesday 14:00
    expect(heatIndex("all", "2026-09-27", 23)).toBe(167); // Sunday 23:00
  });
});
