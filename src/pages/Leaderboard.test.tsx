// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { describeElement, escapesFromScrollers } from "@/testing/layout";

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
  rows: [row(1, "m2", "Lena Park"), row(2, "m1", "Alex Rivera", true), row(3, "m3", "Sam Ortiz"), row(4, "m4", "Kai Weber")],
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
          <Leaderboard />
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
});
