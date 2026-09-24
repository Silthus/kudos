import { describe, expect, test } from "vitest";
import { stampLabel, weekLabel } from "./quests";

describe("the quest log's labels", () => {
  test("a week is named by its Monday, with the year only when it isn't this year's", () => {
    expect(weekLabel("2026-09-14", "2026-09-23")).toBe("Sep 14");
    expect(weekLabel("2025-12-29", "2026-09-23")).toBe("Dec 29, 2025");
  });

  test("a stamp says what happened to the quest, on the workspace's calendar", () => {
    const quest = { key: "fresh", title: "New connection", done: true, waived: null };
    // Sunday 23:30 in Berlin is still Sunday there, though it's Monday in Tokyo.
    const at = Date.UTC(2026, 8, 20, 21, 30);
    expect(stampLabel({ ...quest, completedAt: at }, "Europe/Berlin")).toBe("New connection: completed Sun, Sep 20");
    expect(stampLabel({ ...quest, completedAt: at }, "Asia/Tokyo")).toBe("New connection: completed Mon, Sep 21");
    expect(stampLabel({ ...quest, done: false, completedAt: null }, "Europe/Berlin")).toBe("New connection: not completed");
    expect(stampLabel({ ...quest, done: false, completedAt: null, waived: "no_candidates" }, "Europe/Berlin")).toBe(
      "New connection: not available (you've already recognized everyone 🎉)",
    );
  });
});
