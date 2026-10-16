import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aFound, aGiven, aPage, aReceived, drops } from "./activityFixtures";
import type { ActivityRead, ActivityWatch } from "./activityRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures, type ActivityEntry, type MyActivity } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const now = Date.parse("2026-10-14T18:00:00Z");

const minute = 60 * 1000;

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  window.history.replaceState(null, "", "/activity");
});

afterEach(() => {
  vi.useRealTimers();
});

async function opened(entries: ActivityEntry[], watched: ActivityEntry[] = entries) {
  const read: ActivityRead = async () => aPage(entries, null);
  const watch: ActivityWatch = (filter) => (filter === undefined ? undefined : aPage(watched, null));
  renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), { watch, read });
  await act(async () => {});
}

function main() {
  return screen.getByRole("main");
}

function articles() {
  return within(main()).getAllByRole("article");
}

describe("#467 CL21: a hoggie found shows in the timeline", () => {
  it("renders a found entry centred, with the hoggie's art, saying what was found with its rarity, in the read's order", async () => {
    await opened([aReceived("standup", now - 10 * minute), aFound("rocket", now - 20 * minute, drops.legendaryRocket), aGiven("incident", now - 30 * minute)]);
    const found = within(main()).getByRole("article", { name: "You found a 🟧 Legendary Rocket" });
    expect(found).toHaveAttribute("data-side", "centre");
    expect(found).toHaveAttribute("data-rarity", "legendary");
    expect(found.querySelector("svg")).not.toBeNull();
    expect(within(found).getByText("19:40")).toBeInTheDocument();
    expect(articles().indexOf(found)).toBe(1);
  });

  it("says how many copies a duplicate makes", async () => {
    await opened([aFound("coffee", now - 20 * minute, drops.anotherCoffeeCup)]);
    const found = within(main()).getByRole("article", { name: "You found a ⬜ Common Coffee Cup" });
    expect(within(found).getByText("×4")).toBeInTheDocument();
    expect(within(main()).queryByText("New")).not.toBeInTheDocument();
  });

  it("counts a found entry the subscription holds as new activity", async () => {
    await opened([aReceived("standup", now - 10 * minute)], [aFound("rocket", now - 5 * minute, drops.legendaryRocket), aReceived("standup", now - 10 * minute)]);
    expect(within(main()).getByRole("button", { name: "Show new activity" })).toBeInTheDocument();
  });
});
