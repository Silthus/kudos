import { expect, test } from "vitest";
import { formatMetric, SUCCESS_METRICS, successCsv, verdict } from "./successMetrics";

const result = {
  ready: true as const,
  months: [
    { month: "2026-08", toDate: false, givers: 6, teamSize: 12, kudos: 40, participation: 0.5, recipientsPerGiver: 2.5, storyShare: 0.325, reciprocalShare: 0.1 },
    { month: "2026-09", toDate: true, givers: 0, teamSize: 12, kudos: 0, participation: 0, recipientsPerGiver: null, storyShare: null, reciprocalShare: null },
  ],
  baseline: { from: "2026-06", to: "2026-08", months: 3, participation: 0.5, recipientsPerGiver: 2.5, storyShare: 0.325, reciprocalShare: 0.1 },
};

test("the CSV export has one row per month with raw values, blank where a month has nothing to divide by", () => {
  expect(successCsv(result)).toBe(
    [
      "month,to_date,givers,team_size,participation,kudos,recipients_per_giver,story_share,reciprocal_share",
      "2026-08,false,6,12,0.5,40,2.5,0.325,0.1",
      "2026-09,true,0,12,0,0,,,",
    ].join("\n") + "\n",
  );
});

test("the four metrics come in the spec's order, each with the direction the game should move it", () => {
  expect(SUCCESS_METRICS.map((m) => [m.key, m.goal])).toEqual([
    ["recipientsPerGiver", "rise"],
    ["storyShare", "rise"],
    ["reciprocalShare", "hold"],
    ["participation", "watch"],
  ]);
  expect(formatMetric("recipientsPerGiver", 2.456)).toBe("2.5");
  expect(formatMetric("storyShare", 0.325)).toBe("33%");
  expect(formatMetric("reciprocalShare", null)).toBe("–");
});

test("a verdict compares this month with the baseline in the direction that counts", () => {
  const story = SUCCESS_METRICS.find((m) => m.key === "storyShare")!;
  const reciprocal = SUCCESS_METRICS.find((m) => m.key === "reciprocalShare")!;
  expect(verdict(story, 0.4, 0.3)).toBe("better");
  expect(verdict(story, 0.2, 0.3)).toBe("worse");
  expect(verdict(reciprocal, 0.2, 0.1)).toBe("worse"); // thank-backs must not rise
  expect(verdict(reciprocal, 0.05, 0.1)).toBe("better");
  expect(verdict(story, 0.3, 0.3)).toBe("same");
  expect(verdict(story, null, 0.3)).toBe(null);
});
