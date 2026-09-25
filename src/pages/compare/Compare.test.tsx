// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, expect, test, vi } from "vitest";
import { InWindow, windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The mirror pond (#132): Compare in its window, you against one benchmark at a time. */

const row = (metric: string, family: "giving" | "receiving", you: number | null, benchmark: number | null, locked: string | null = null) => ({
  metric,
  family,
  you: { value: locked ? null : you, locked },
  benchmark: { value: locked ? null : benchmark, locked },
  delta: locked || you === null || benchmark === null ? null : you - benchmark,
});
const days = ["2026-09-01", "2026-09-02", "2026-09-03"];
const past = {
  mode: "past",
  period: "month",
  label: "This month",
  benchmarkLabel: "Last month",
  range: { start: "2026-09-01", end: "2026-09-25" },
  benchmarkRange: { start: "2026-08-01", end: "2026-08-25" },
  previousRange: { start: "2026-08-01", end: "2026-08-31" },
  benchmarkNote: null,
  joinedOn: null,
  rows: [row("given", "giving", 14, 9), row("received", "receiving", null, null, "private"), row("questsCompleted", "giving", 3, 1)],
  previousTotal: { given: 12, received: null },
  race: { days, previousDays: ["2026-08-01", "2026-08-02", "2026-08-03"], you: { given: [2, 5, 14], received: null }, benchmark: { given: [1, 4, 9], received: null } },
  truncated: false,
};
const team = {
  mode: "team",
  period: "month",
  label: "This month",
  range: { start: "2026-09-01", end: "2026-09-25" },
  participants: 12,
  rows: [
    { ...row("given", "giving", 14, 6), delta: null, team: { n: 12, median: 6, p25: 3, p75: 10, max: 20 }, percentile: 0.75 },
    { ...row("questsCompleted", "giving", null, null, "personal"), delta: null, team: null, percentile: null },
  ],
  truncated: false,
};
const teammate = {
  mode: "teammate",
  period: "month",
  label: "This month",
  range: { start: "2026-09-01", end: "2026-09-25" },
  teammate: { _id: "m2", name: "Ben Okafor", avatarUrl: null },
  rows: [row("given", "giving", 14, 9), row("received", "receiving", null, null, "hidden")],
  race: { days, you: { given: [2, 5, 14], received: null }, benchmark: { given: [3, 6, 9], received: null } },
  truncated: false,
};

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    if (args === "skip") return undefined;
    return ({ "compare/past:get": past, "compare/team:get": team, "compare/teammate:get": teammate, "compare/candidates:list": [] } as Record<string, unknown>)[getFunctionName(fn)];
  },
}));

const { Compare } = await import("./Compare");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const viewer = {
  member: { _id: "m1", name: "Alex Rivera", isAdmin: false },
  workspace: { name: "Lumen Labs", emojiGlyph: "🌮", unitSingular: "taco", unitPlural: "tacos", timezone: "Europe/Berlin" },
} as unknown as ReadyViewer;

let root: Root | undefined;
let host: HTMLElement;
let location = "";
function Where() {
  const l = useLocation();
  location = l.pathname + l.search;
  return null;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function render(url = "/compare") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[url]}>
        <ViewerContext.Provider value={viewer}>
          <InWindow>
            <Compare />
          </InWindow>
          <Where />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return host;
}

const tabs = (label: string) => [...host.querySelectorAll(`[role=tablist][aria-label="${label}"] [role=tab]`)] as HTMLButtonElement[];
const reflection = () => host.querySelector("[data-reflection]")?.textContent?.replace(/\s+/g, " ") ?? "";

test("the benchmark is three pixel tabs on the water's edge: Past you, A teammate, The team", () => {
  render();
  expect(tabs("Compare with").map((t) => t.textContent)).toEqual(["Past you", "A teammate", "The team"]);
  expect(host.querySelector("[data-water-edge]")).not.toBeNull();
  expect(tabs("Period").map((t) => t.textContent)).toContain("Month");
});

test("the URL keeps the comparison: a bare /compare is Past you this month, and a new benchmark is a new entry", () => {
  render();
  expect(location).toBe("/compare?vs=past&period=month");
  act(() => tabs("Compare with")[2].click());
  expect(location).toBe("/compare?vs=team&period=month");
  act(() => tabs("Period").find((t) => t.textContent === "Quarter")!.click());
  expect(location).toBe("/compare?vs=team&period=quarter");
});

test("Past you: the headline is a reflection, you over the water and past you mirrored in it", () => {
  render("/compare?vs=past&period=month");
  expect(reflection()).toContain("You gave 14 tacos");
  expect(reflection()).toContain("Past you gave 9");
});

test("a teammate and the team are reflected the same way", () => {
  render("/compare?vs=m2&period=month");
  expect(reflection()).toContain("You gave 14 tacos");
  expect(reflection()).toContain("Ben gave 9");
  act(() => root?.unmount());
  host.remove();
  render("/compare?vs=team&period=month");
  expect(reflection()).toContain("You gave 14 tacos");
  expect(reflection()).toContain("The team's median is 6");
});

test("the scoreboard is a parchment table where a locked row shows a padlock and says why", () => {
  render("/compare?vs=past&period=month");
  const table = host.querySelector("table")!;
  const received = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Received"))!;
  expect(received.querySelector("[data-padlock]")).not.toBeNull();
  expect(received.textContent).toContain("Only visible to each member");
  // The race keeps its data table.
  expect([...host.querySelectorAll("summary")].map((s) => s.textContent)).toContain("Show data");
});

test.each(["/compare?vs=past&period=month", "/compare?vs=team&period=month", "/compare?vs=m2&period=month"])("%s lays out by the window, reads on parchment and has no page sign", (url) => {
  render(url);
  expect(windowPageProblems(host)).toEqual([]);
});
