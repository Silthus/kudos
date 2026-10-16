import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { slackTextOf } from "../slack/delivery";
import { renderEveryoneBoard } from "./leaderboard";

const ants = { group: "g1" as Id<"userGroups">, name: "Ants" };

describe("GB16 WS344: the peer line says what the website's says", () => {
  test.each([
    { percent: 90, line: "You improved more than 90% of Ants." },
    { percent: 99, line: "You improved more than 99% of Ants." },
    { percent: 100, line: "You improved more than everyone else in Ants." },
    { percent: 101, line: "You improved more than everyone else in Ants." },
  ])("at $percent percent: $line", ({ percent, line }) => {
    const lines = renderEveryoneBoard({ rows: [], improvement: null, peer: { percent, group: ants } }, "week");

    expect(slackTextOf(lines)).toBe(line);
  });
});
