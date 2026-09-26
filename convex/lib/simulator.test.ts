import { describe, expect, test } from "vitest";
import { botRecipients, BOT_NOTES, morningOf, simulatorStart } from "./simulator";
import { countNoteWords } from "./parse";
import { dayKeyFor, zonedParts } from "./time";

const BERLIN = "Europe/Berlin";
const local = (ts: number) => {
  const p = zonedParts(ts, BERLIN);
  return `${dayKeyFor(ts, BERLIN)} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

describe("the simulator's clock moves from morning to morning", () => {
  test("advancing lands at 09:00 on the day N days later", () => {
    const now = Date.parse("2026-09-23T20:15:00Z"); // 22:15 in Berlin
    expect(local(morningOf(now, BERLIN, 1))).toBe("2026-09-24 09:00");
    expect(local(morningOf(now, BERLIN, 30))).toBe("2026-10-23 09:00");
  });

  test("across the autumn DST switch (a 25 h day) it still lands at 09:00", () => {
    const now = Date.parse("2026-10-24T21:30:00Z"); // 23:30 CEST on Saturday
    expect(local(morningOf(now, BERLIN, 1))).toBe("2026-10-25 09:00");
    expect(local(morningOf(now, BERLIN, 2))).toBe("2026-10-26 09:00");
  });

  test("across the spring DST switch (a 23 h day) it never skips a day", () => {
    const now = Date.parse("2026-03-28T22:30:00Z"); // 23:30 CET on Saturday
    expect(local(morningOf(now, BERLIN, 1))).toBe("2026-03-29 09:00");
    expect(local(morningOf(now, BERLIN, 2))).toBe("2026-03-30 09:00");
  });

  test("a simulator starts at the next 09:00, never behind the wall clock", () => {
    const early = Date.parse("2026-09-23T04:00:00Z"); // 06:00 in Berlin
    expect(local(simulatorStart(early, BERLIN))).toBe("2026-09-23 09:00");
    const late = Date.parse("2026-09-23T10:00:00Z"); // 12:00 in Berlin
    expect(local(simulatorStart(late, BERLIN))).toBe("2026-09-24 09:00");
    expect(simulatorStart(late, BERLIN)).toBeGreaterThanOrEqual(late);
  });
});

describe("the fast-forward bot", () => {
  const team = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  test("thanks different teammates each day, rotating through everyone", () => {
    const week = [0, 1, 2].map((day) => botRecipients({ day, teammates: team, waterFirst: [], count: 5 }));
    for (const today of week) expect(new Set(today).size).toBe(5);
    expect(new Set(week.flat()).size).toBe(12);
  });

  test("waters the plants it grows first", () => {
    expect(botRecipients({ day: 0, teammates: team, waterFirst: ["K", "L"], count: 3 })).toEqual(["K", "L", "A"]);
  });

  test("never gives more than the allowance left", () => {
    expect(botRecipients({ day: 4, teammates: team, waterFirst: [], count: 0 })).toEqual([]);
  });

  test("writes a detailed note (12+ words) every time", () => {
    for (const note of BOT_NOTES) expect(countNoteWords(note, "taco", "🌮")).toBeGreaterThanOrEqual(12);
  });
});
