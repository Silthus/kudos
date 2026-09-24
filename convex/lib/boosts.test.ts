import { describe, expect, test } from "vitest";
import { announcementText, boostAt, dayLabel } from "./boosts";

describe("which boost is on", () => {
  const boosts = [
    { dayKey: "2026-09-23", from: 1000, kind: "double" as const },
    { dayKey: "2026-09-25", from: 5000, kind: "unsung" as const },
  ];
  test("the day's boost, from the moment it started", () => {
    expect(boostAt(boosts, "2026-09-23", 999)).toBeUndefined();
    expect(boostAt(boosts, "2026-09-23", 1000)?.kind).toBe("double");
    expect(boostAt(boosts, "2026-09-24", 9999)).toBeUndefined();
    expect(boostAt(boosts, "2026-09-25", 6000)?.kind).toBe("unsung");
  });
});

describe("the announcement (§G9, G10, G13)", () => {
  test("names the day in words", () => {
    expect(dayLabel("2026-09-25")).toBe("Friday, 25 September");
  });

  test("a booster: who activated it, what it doubles, until midnight", () => {
    expect(announcementText({ kind: "double", source: "booster", dayKey: "2026-09-23", today: "2026-09-23", who: "<@UANA>" })).toBe(
      "<@UANA> activated a Kudos booster: Double. Today is a bonus day: until midnight, every thoughtful kudos earns double XP and Hog coins.",
    );
    expect(announcementText({ kind: "rekindle", source: "booster", dayKey: "2026-09-23", today: "2026-09-23", who: "Ana" })).toBe(
      "Ana activated a Kudos booster: Rekindles. Until midnight, thoughtful kudos to someone you haven't thanked in 30 days earn double XP and Hog coins.",
    );
  });

  test("a scheduled bonus day, announced in advance", () => {
    expect(announcementText({ kind: "double", source: "schedule", dayKey: "2026-09-25", today: "2026-09-23", who: "<@UANA>" })).toBe(
      "Bonus day on Friday, 25 September: all day, every thoughtful kudos earns double XP and Hog coins.",
    );
    expect(announcementText({ kind: "double", source: "schedule", dayKey: "2026-09-24", today: "2026-09-23", who: null })).toBe(
      "Bonus day tomorrow, Thursday, 24 September: all day, every thoughtful kudos earns double XP and Hog coins.",
    );
  });

  test("the team garden and the Block party capstone (#96) say what started them", () => {
    expect(announcementText({ kind: "double", source: "team_garden", dayKey: "2026-09-25", today: "2026-09-23", who: null })).toBe(
      "The team garden reached a milestone: bonus day on Friday, 25 September! All day, every thoughtful kudos earns double XP and Hog coins.",
    );
    expect(announcementText({ kind: "double", source: "capstone", dayKey: "2026-09-23", today: "2026-09-23", who: "Ana" })).toBe(
      "Ana called a bonus day for today: until midnight, every thoughtful kudos earns double XP and Hog coins.",
    );
  });
});
