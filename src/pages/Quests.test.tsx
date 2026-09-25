// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";
import { copyTells, InWindow, viewportLayout } from "@/testing/window";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

const quest = (key: string, title: string, over: Record<string, unknown> = {}) => ({
  key,
  title,
  description: `${title} description`,
  group: "people",
  progress: 0,
  goal: 2,
  status: "active",
  waivedReason: null,
  completedAt: null,
  messageRarity: null,
  ...over,
});
const onBoard = {
  enabled: true,
  weekKey: "2026-09-21",
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  resetsAt: 0,
  quests: [
    quest("fresh", "New connection", { status: "done", progress: 1, goal: 1, completedAt: Date.now(), messageRarity: "rare" }),
    quest("steady", "Steady hand", { progress: 1, goal: 3 }),
    quest("rekindle", "Rekindle", { status: "waived", waivedReason: "no_candidates" }),
  ],
  completed: 1,
  available: 2,
  sweep: true,
  locked: null,
  daily: { key: "detail", title: "Tell the story", description: "Write a reason of 12+ words", dayKey: "2026-09-23", progress: 0, goal: 1, status: "active", completedAt: null },
  rewards: { weekly: { xp: 20, coins: 5 }, daily: { xp: 10, coins: 2 }, sweep: { xp: 30, coins: 0 } },
};
const log = {
  totals: { completed: 12, sweeps: 2, weeksWithCompletion: 6 },
  weeks: [
    {
      weekKey: "2026-09-14",
      sweep: true,
      board: [
        { key: "spread", title: "Spread the love", done: true, completedAt: Date.now(), waived: null },
        { key: "fresh", title: "New connection", done: false, completedAt: null, waived: null },
        { key: "rekindle", title: "Rekindle", done: false, completedAt: null, waived: "no_candidates" },
      ],
    },
  ],
};
let board: unknown = onBoard;

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    return name === "quests:mine" ? board : name === "quests:history" ? log : undefined;
  },
}));

const { Quests } = await import("./Quests");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  board = onBoard;
});

function render() {
  const viewer = { member: { _id: "m1", name: "Alex Rivera" }, workspace: { name: "Lumen Labs", timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <InWindow>
            <Quests />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
  return host;
}

test("the signpost pins this week's three quests as papers, and today's quest as a smaller note", () => {
  const host = render();
  const papers = [...host.querySelectorAll("[data-quest-paper]")];
  expect(papers.map((p) => p.querySelector("h4")?.textContent)).toEqual(["New connection", "Steady hand", "Rekindle"]);
  expect(host.querySelector("[data-daily-quest]")?.textContent).toContain("Tell the story");
  // The done paper wears a hedge rim; open ones don't.
  expect(papers.map((p) => p.querySelector("[data-done-rim]") !== null)).toEqual([true, false, false]);
  // No page sign: the window's title names the signpost.
  expect(host.querySelector("h1")).toBeNull();
});

test("progress is a pixel meter on the open quest, and a clean sweep is a chip in words", () => {
  const host = render();
  const open = [...host.querySelectorAll("[data-quest-paper]")][1];
  expect(open.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("1");
  const sweep = [...host.querySelectorAll(".pixel-chip")].filter((c) => c.textContent === "Clean sweep");
  expect(sweep.length).toBeGreaterThan(0);
});

test("its words are signposts: no middle dots, arrows or emoji", () => {
  const host = render();
  expect(copyTells(host)).toEqual([]);
});

test("the signpost lays out by the window's width and never scrolls sideways", () => {
  const host = render();
  expect(viewportLayout(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
});

test("past weeks are a row of stamps: done, not done and not available, each labelled", () => {
  const host = render();
  const stamps = [...host.querySelectorAll("[data-stamp]")];
  expect(stamps.map((s) => s.getAttribute("data-stamp"))).toEqual(["done", "open", "waived"]);
  expect(stamps[0].textContent).toContain("Spread the love: completed");
  expect(stamps[2].textContent).toContain("Rekindle: not available");
});

test("with quests off the signpost holds a parchment note, and the log stays", () => {
  board = { enabled: false, hidden: false };
  const host = render();
  const note = host.querySelector(".pixel-note")!;
  expect(note.textContent).toContain("Quests are off in this workspace");
  expect(host.querySelectorAll("[data-stamp]")).toHaveLength(3);
});

test("with the game hidden the note says where to show it again: the cabin", () => {
  board = { enabled: false, hidden: true };
  const host = render();
  const note = host.querySelector(".pixel-note")!;
  expect(note.textContent).toContain("part of the game you've hidden");
  expect(note.querySelector("a[href='/me']")?.textContent).toBe("Go to your cabin");
});
