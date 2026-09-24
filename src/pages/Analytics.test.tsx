// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

const overview = {
  period: "month",
  label: "This month",
  range: { start: "2026-09-01", end: "2026-09-23", days: 23 },
  showPeople: false,
  unit: { glyph: "🌮", singular: "taco", plural: "tacos" },
  kpis: {
    total: 10, prevTotal: 8, givers: 3, prevGivers: 2, receivers: 4, teamSize: 6, participation: 0.5, prevParticipation: 0.4,
    avgPerGiver: 3.3, allowanceUse: 0.5, messages: 7, maxedDays: 0, topShare: 0.4, newGivers: 1, retained: 2,
  },
  grain: "day",
  volume: [{ day: "2026-09-01", total: 1, prevTotal: 0 }],
  heatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
  channels: [],
  sources: [],
  topGivers: [],
  topReceivers: null,
  topPairs: null,
  rarity: [],
  truncated: false,
};
let success: unknown = {
  ready: true,
  months: [
    { month: "2026-08", toDate: false, givers: 6, teamSize: 12, kudos: 40, participation: 0.5, recipientsPerGiver: 2.5, storyShare: 0.3, reciprocalShare: 0.1 },
    { month: "2026-09", toDate: true, givers: 4, teamSize: 12, kudos: 20, participation: 1 / 3, recipientsPerGiver: 3, storyShare: 0.45, reciprocalShare: 0.15 },
  ],
  baseline: { from: "2026-06", to: "2026-08", months: 3, participation: 0.5, recipientsPerGiver: 2.5, storyShare: 0.3, reciprocalShare: 0.1 },
};
const asked: string[] = [];

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    const name = getFunctionName(fn);
    if (args !== "skip") asked.push(name);
    if (name === "analytics:overview") return overview;
    if (name === "analytics:successMetrics" && args !== "skip") return success;
    return undefined;
  },
}));
vi.mock("@/components/charts", () => ({
  BarChart: () => null, BarList: () => null, Heatmap: () => null, Legend: () => null, Sparkline: () => null,
}));

const { Analytics } = await import("./Analytics");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  asked.length = 0;
});

function render(isAdmin: boolean) {
  const viewer = {
    member: { _id: "m1", name: "Alex Rivera", isAdmin },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", timezone: "Europe/Berlin" },
  } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <Analytics />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return host;
}

const section = (host: HTMLElement) => host.querySelector("#success-metrics") as HTMLElement | null;

test("admins see this month's success metrics against the baseline, each with its goal", () => {
  const card = section(render(true))!;
  expect(card.textContent).toContain("Game success metrics");
  const tile = (label: string) => [...card.querySelectorAll("[data-metric]")].find((t) => t.getAttribute("data-metric") === label)!.textContent;
  expect(tile("recipientsPerGiver")).toContain("3.0");
  expect(tile("recipientsPerGiver")).toContain("Baseline 2.5");
  expect(tile("recipientsPerGiver")).toContain("should rise");
  expect(tile("storyShare")).toContain("45%");
  expect(tile("reciprocalShare")).toContain("must not rise");
  expect(tile("participation")).toContain("33%");
  expect(card.textContent).toContain("Jun – Aug 2026");
  expect(card.textContent).toContain("Download CSV");
});

test("the data table lists every month, the current one marked as to date", () => {
  const card = section(render(true))!;
  act(() => (card.querySelector("button[aria-controls='success-table']") as HTMLButtonElement).click());
  const rows = [...card.querySelectorAll("#success-table tbody tr")].map((r) => r.textContent);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toContain("Sep 2026 (to date)");
  expect(rows[1]).toContain("45%");
});

test("before a rebuild computed them, admins learn why there is nothing yet", () => {
  success = { ready: false, months: [], baseline: null };
  const card = section(render(true))!;
  expect(card.textContent).toContain("after the next rollup rebuild");
  success = undefined;
});

test("members never see or ask for them", () => {
  const host = render(false);
  expect(section(host)).toBeNull();
  expect(asked).not.toContain("analytics:successMetrics");
});
