import { describe, expect, test } from "vitest";
import { improvementLine } from "./improvementLine";

describe("G18's improvement line in words", () => {
  test.each([
    { rule: "a gain with places climbed names both", improvement: { gain: 4, places: 2 }, period: "week", line: "▲ 4 more kudos than this time last week · ▲ 2 places" },
    { rule: "a gain without places names the gain alone", improvement: { gain: 2 }, period: "month", line: "▲ 2 more kudos than this time last month" },
    { rule: "no gain names the best completed period", improvement: { best: 6 }, period: "week", line: "Your best week so far: 6 kudos." },
    { rule: "the best period follows the period asked for", improvement: { best: 19 }, period: "month", line: "Your best month so far: 19 kudos." },
  ] as const)("$rule", ({ improvement, period, line }) => {
    expect(improvementLine(improvement, period)).toBe(line);
  });
});
