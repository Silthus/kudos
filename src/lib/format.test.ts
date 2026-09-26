import { afterEach, expect, test, vi } from "vitest";
import { relativeTime, setWorkspaceClock, workspaceClockNow } from "./format";

/**
 * A simulator's clock runs ahead of the wall clock (#143, #144): "how long ago" is measured on the
 * workspace's clock, so a kudos given this simulated morning says "just now", not "in 3 days".
 */

const DAY = 24 * 60 * 60 * 1000;
afterEach(() => {
  setWorkspaceClock(0);
  vi.useRealTimers();
});

test("with no offset, the workspace clock is the wall clock (every real workspace)", () => {
  vi.useFakeTimers({ now: new Date("2026-09-26T08:00:00Z") });
  expect(workspaceClockNow()).toBe(Date.parse("2026-09-26T08:00:00Z"));
  expect(relativeTime(Date.parse("2026-09-26T07:00:00Z"))).toBe("1h ago");
});

test("in a simulator three days ahead, a kudos given on its clock an hour ago was an hour ago", () => {
  vi.useFakeTimers({ now: new Date("2026-09-26T08:00:00Z") });
  setWorkspaceClock(3 * DAY);
  expect(workspaceClockNow()).toBe(Date.parse("2026-09-29T08:00:00Z"));
  expect(relativeTime(Date.parse("2026-09-29T07:00:00Z"))).toBe("1h ago");
  expect(relativeTime(Date.parse("2026-09-29T07:59:50Z"))).toBe("just now");
  expect(relativeTime(Date.parse("2026-09-27T08:00:00Z"))).toBe("2d ago");
});

test("an explicit now still wins", () => {
  setWorkspaceClock(3 * DAY);
  expect(relativeTime(0, 2 * 60 * 60 * 1000)).toBe("2h ago");
});
