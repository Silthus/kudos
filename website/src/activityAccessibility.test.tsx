import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aPage, aReceived, activityFixtures } from "./activityFixtures";
import type { ActivityRead } from "./activityRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures, type Activity, type MyActivity } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const now = Date.parse("2026-10-14T18:00:00Z");

async function violationsIn(container: Element) {
  const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

type Step = (read: { resolve: (answer: MyActivity) => void; reject: (failure: Error) => void }[]) => Promise<void>;

const story = activityFixtures.story;

const withMore: Activity = { ...story, cursor: "c1" };

const answerFirst = (answer: MyActivity): Step => async (asked) => act(async () => asked[0]!.resolve(answer));

const pressLoadMore: Step = async () => act(async () => screen.getByRole("button", { name: "Load more" }).click());

const states: { name: string; watch: Activity; steps: Step[]; shows: string }[] = [
  { name: "waiting for its first page", watch: story, steps: [], shows: "Your kudos story" },
  { name: "with all three kinds, a deleted message, a private channel, an edited message and a null permalink", watch: story, steps: [answerFirst(story)], shows: "That's the start of your activity." },
  { name: "loading more", watch: withMore, steps: [answerFirst(withMore), pressLoadMore], shows: "Loading…" },
  { name: "failing to load more", watch: withMore, steps: [answerFirst(withMore), pressLoadMore, async (asked) => act(async () => asked[1]!.reject(new Error("socket closed")))], shows: "Try again" },
  { name: "failing its first page", watch: story, steps: [async (asked) => act(async () => asked[0]!.reject(new Error("socket closed")))], shows: "Couldn't load your activity." },
  { name: "empty", watch: activityFixtures.nothingYet, steps: [answerFirst(activityFixtures.nothingYet)], shows: "Your activity shows here once you thank someone or reach a level." },
  { name: "with new activity to show", watch: aPage([aReceived("new", now - 1000), ...story.entries], null), steps: [answerFirst(story)], shows: "Show new activity" },
];

describe("WS223: every state of /activity passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of states) {
      it(`the timeline ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", "/activity");
        const asked: Parameters<Step>[0] = [];
        const read: ActivityRead = () => new Promise((resolve, reject) => asked.push({ resolve, reject }));
        const { container } = renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), { watch: () => state.watch, read });
        for (const step of state.steps) await step(asked);
        expect(within(screen.getByRole("main")).getAllByText(state.shows, { exact: false }).length).toBeGreaterThan(0);
        expect(await violationsIn(container)).toEqual([]);
      });
    }
  }
});
