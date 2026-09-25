// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { PERIOD_OPTIONS } from "@/lib/period";
import { describeElement, escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";
import { copyTells, InWindow, viewportLayout } from "@/testing/windowPage";

const row = (rank: number, id: string, name: string, isMe = false) => ({
  rank,
  member: { _id: id, name, title: null, avatarUrl: null, slackUserId: `U${id}` },
  value: 10 - rank,
  prevValue: 5,
  delta: 5 - rank,
  prevRank: rank,
  rankChange: 0,
  isNew: false,
  maxedDays: 1,
  isMe,
  comparable: !isMe,
});
const board = {
  period: "month",
  label: "This month",
  range: { start: "2026-09-01", end: "2026-09-30" },
  previousRange: { start: "2026-08-01", end: "2026-08-31" },
  metric: "given",
  receivedAllowed: false,
  rows: [] as ReturnType<typeof row>[],
  highlights: { total: 30, prevTotal: 20, givers: 4, teamSize: 5, participation: 0.8, rising: 3, discoveries: 2, legendaryFinds: 0, maxedDays: 4 },
  unit: { singular: "kudos", plural: "kudos", glyph: "🌮" },
  myRow: null,
};

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "leaderboard:get" ? board : undefined),
}));
vi.mock("@/components/charts", () => ({ Ring: () => null }));

const { Leaderboard } = await import("./Leaderboard");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const standings = () => [row(1, "m2", "Lena Park"), row(2, "m1", "Alex Rivera", true), row(3, "m3", "Sam Ortiz"), row(4, "m4", "Kai Weber")];
beforeEach(() => void (board.rows = standings()));
afterEach(() => act(() => root?.unmount()));

function render() {
  const viewer = {
    member: { _id: "m1", name: "Alex Rivera", isAdmin: false },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", timezone: "Europe/Berlin" },
  } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <InWindow>
            <Leaderboard />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return host;
}

test("on a phone the standings table scrolls inside its card, and nothing in it widens the page", () => {
  const host = render();
  const compareHeader = [...host.querySelectorAll("th .sr-only")].find((s) => s.textContent === "Compare");
  expect(compareHeader, "the Compare column keeps its screen-reader header").toBeDefined();
  expect(host.querySelector("table")!.parentElement!.classList, "the wide table scrolls sideways on its own").toContain("overflow-x-auto");
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
});

test("the notice board has no page sign, and its words are signposts: no crown, no middle dots, no arrows", () => {
  const host = render();
  expect(host.querySelector("h1")).toBeNull();
  expect(copyTells(host, ["🌮"])).toEqual([]);
  expect(host.textContent).not.toContain("YOU");
});

test("the notice board lays out by the window's width, not the screen's", () => {
  const host = render();
  expect(viewportLayout(host).map(describeElement)).toEqual([]);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
});

test("the period switcher is a row of pixel tabs", () => {
  const host = render();
  const tabs = [...host.querySelectorAll("[role=tablist]")].map((l) => [...l.querySelectorAll("[role=tab]")].map((t) => t.textContent));
  expect(tabs).toContainEqual(PERIOD_OPTIONS.map((o) => o.label));
});

test("every comparable row has a Compare pixel button that walks to the mirror pond; your own row has none", () => {
  const host = render();
  const buttons = [...host.querySelectorAll<HTMLAnchorElement>("tbody a.pixel-btn")];
  expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Compare with Lena", "Compare with Sam", "Compare with Kai"]);
  expect(buttons[0].getAttribute("href")).toBe("/compare?vs=m2&period=month");
  expect(buttons[0].textContent).toBe("Compare");
});

test("a change of place is a small pixel arrow, up in hedge and down in ember, and says so in words", () => {
  board.rows[2] = { ...board.rows[2], rankChange: 2 };
  board.rows[3] = { ...board.rows[3], rankChange: -1 };
  const host = render();
  const rows = [...host.querySelectorAll("tbody tr")];
  expect(rows[2].querySelector("svg.text-hedge-deep")).not.toBeNull();
  expect(rows[2].textContent).toContain("2 places up");
  expect(rows[3].querySelector("svg.text-ember-deep")).not.toBeNull();
  expect(rows[3].textContent).toContain("1 place down");
});

test("without an earlier period to compare with, the change column says so instead of 'none'", () => {
  board.rows = board.rows.map((r) => ({ ...r, delta: null, rankChange: null })) as never;
  const host = render();
  const change = [...host.querySelectorAll("tbody tr")][0].querySelectorAll("td")[3];
  expect(change.textContent).toContain("No earlier period");
  expect(change.textContent).not.toContain("none");
});

test("a teammate far behind the leader still gets a block on their meter", () => {
  board.rows = [{ ...row(1, "m2", "Lena Park"), value: 86 }, { ...row(2, "m3", "Sam Ortiz"), value: 1 }];
  const host = render();
  const fills = [...host.querySelectorAll<HTMLElement>("tbody [data-fill]")].map((f) => f.style.getPropertyValue("--fill"));
  expect(fills[1]).toMatch(/^clamp\(4px/);
});

test("the podium names the top three with their titles, as a labelled group", () => {
  board.rows = board.rows.map((r) => ({ ...r, member: { ...r.member, title: `${r.member.name} title` } })) as never;
  const host = render();
  const podium = host.querySelector("[aria-label='The top three']")!;
  expect(podium.getAttribute("role")).toBe("group");
  expect(podium.textContent).toContain("Lena Park title");
});

test("on a phone the period tabs wrap, so every period stays in sight", () => {
  const host = render();
  const periods = [...host.querySelectorAll("[role=tablist]")].find((l) => l.textContent?.includes("Quarter"))!;
  expect(periods.className).toContain("flex-wrap");
});
