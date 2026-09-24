// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

const overview = {
  periodLabel: "This month",
  today: { used: 0, limit: 5 },
  week: { given: 2, lastWeekGiven: 1, start: "2026-09-21", end: "2026-09-27" },
  period: { given: 4, prevGiven: null },
  totals: { given: 10, received: 3, maxedDays: 0 },
  cadence: [{ day: "2026-09-23", given: 1, received: 0, prevGiven: 0 }],
  patterns: { teammatesCelebrated: 2, channelsVisited: 1, currentStreak: 1, longestStreak: 2, bestWeekday: null, topRecipient: null, topSupporter: null },
  activity: [],
  botMessages: [],
  discoveries: { discovered: 1, total: 72, byRarity: [], latest: [] },
};
const board = {
  enabled: true,
  weekKey: "2026-09-21",
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  resetsAt: 0,
  quests: [],
  completed: 0,
  available: 3,
  sweep: false,
};
const asked: string[] = [];

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    const name = getFunctionName(fn);
    if (args !== "skip") asked.push(name);
    if (name === "me:overview") return overview;
    if (name === "quests:mine") return board;
    return undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/charts", () => ({ LineChart: () => null, Legend: () => null }));

const { Me } = await import("./Me");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  asked.length = 0;
});

function render(questsEnabled: boolean) {
  const viewer = {
    member: { _id: "m1", name: "Alex Rivera", isAdmin: false },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", timezone: "Europe/Berlin", storeEnabled: false, questsEnabled },
    canSeeOwnReceived: true,
    canSeeOthersReceived: false,
  } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <Me />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  return host;
}
const activityCard = (host: HTMLElement) => [...host.querySelectorAll("h2")].find((h) => h.textContent === "Recent activity")!.closest(".xl\\:col-span-7, .xl\\:col-span-12")!;

test("with quests on, the weekly quests card sits next to recent activity", () => {
  const host = render(true);
  expect(host.textContent).toContain("Weekly quests");
  expect(activityCard(host).className).toContain("xl:col-span-7");
});

test("with quests switched off, there is no quest card and recent activity takes the whole row", () => {
  const host = render(false);
  expect(host.textContent).not.toContain("Weekly quests");
  expect(asked).not.toContain("quests:mine");
  expect(activityCard(host).className).toContain("xl:col-span-12");
});
