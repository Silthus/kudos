// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";
import { copyTells, InWindow, viewportLayout } from "@/testing/window";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

const overview = {
  periodLabel: "This month",
  today: { used: 2, limit: 5 },
  week: { given: 2, lastWeekGiven: 1, start: "2026-09-21", end: "2026-09-27" },
  period: { given: 4, prevGiven: null },
  totals: { given: 10, received: 3, maxedDays: 0 },
  cadence: [{ day: "2026-09-23", given: 1, received: 0, prevGiven: 0 }],
  patterns: { teammatesCelebrated: 2, channelsVisited: 1, currentStreak: 1, longestStreak: 2, bestWeekday: null, topRecipient: null, topSupporter: null },
  activity: [] as unknown[],
  botMessages: [] as unknown[],
  discoveries: { discovered: 1, total: 72, byRarity: [], latest: [] as unknown[] },
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
  sweep: true,
};
const player = (level: number) => ({ level, title: "Seedling", xp: 40, floor: 30, next: 75, toNext: 35, fraction: 0.2 });
const wallet = { balance: 28, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromSprees: 0, fromLevels: 20, spent: 0, adjusted: 0 };
let game: unknown = null;
const asked: string[] = [];
const signOut = vi.fn(async () => undefined);
const mutate = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    const name = getFunctionName(fn);
    if (args === "skip") return undefined;
    asked.push(name);
    if (name === "me:overview") return overview;
    if (name === "quests:mine") return board;
    if (name === "game:mine") return game;
    return undefined;
  },
  useMutation: () => mutate,
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut }) }));
vi.mock("@/components/charts", () => ({ LineChart: () => null, Legend: () => null }));

const { Me } = await import("./Me");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  asked.length = 0;
  game = null;
  mutate.mockClear();
});

type Options = { questsEnabled?: boolean; workspaces?: { memberId: string; name: string; current: boolean }[] };
function render({ questsEnabled = true, workspaces = [] }: Options = {}) {
  const viewer = {
    workspaces,
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
          <InWindow>
            <Me />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  // Text written for parchment never lands on the dusk ground (#127).
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
  return host;
}
const headings = (host: HTMLElement) => [...host.querySelectorAll("h2")].map((h) => h.textContent);
const section = (host: HTMLElement, title: string) => [...host.querySelectorAll("h2")].find((h) => h.textContent === title)?.closest("section") ?? null;

test("the cabin is one window of rooms, in order: you, your giving, your look, lately, found lately, the bot, the quests and the door", () => {
  game = { enabled: true, hidden: false, player: player(2), wallet: null };
  const host = render();
  // "Your look" shows only while you play (its query answers null otherwise, and here nothing).
  expect(headings(host)).toEqual(["You", "Your giving", "Lately", "Found lately", "From the bot", "Quests this week", "The door"]);
  // No page sign: the window's title already names the cabin.
  expect(host.querySelector("h1")).toBeNull();
});

test("the cabin lays out by the window's width, so a 640 px window never scrolls sideways (#128 review #9)", () => {
  game = { enabled: true, hidden: false, player: player(3), wallet };
  const host = render();
  expect(viewportLayout(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
});

test("its words are signposts: no middle dots, arrows or emoji, only the workspace's kudos emoji", () => {
  game = { enabled: true, hidden: false, player: player(3), wallet };
  overview.botMessages = [{ _id: "n1", rarity: "rare", category: "receiver_success", text: "Ana sent you 1 🌮.", isNewDiscovery: true, at: Date.now(), gains: [] }];
  overview.discoveries.latest = [{ key: "d1", rarity: "rare", text: "A kind word", timesSeen: 2, firstSeenAt: Date.now() }];
  const host = render();
  expect(copyTells(host, ["🌮"])).toEqual([]);
  overview.botMessages = [];
  overview.discoveries.latest = [];
});

test("below level 3 the cabin shows no Hog coins at all, only the wallet's locked tile", () => {
  game = { enabled: true, hidden: false, player: player(2), wallet: null };
  const host = render();
  expect(host.querySelector("[data-wallet]")).toBeNull();
  expect(host.querySelector("[data-hog-coin]")).toBeNull();
  expect(host.querySelector("[data-locked][aria-label^='Hog coins']")).not.toBeNull();
});

test("from level 3 the wallet is in the room called You", () => {
  game = { enabled: true, hidden: false, player: player(3), wallet };
  const host = render();
  expect(section(host, "You")!.querySelector("[data-wallet]")?.getAttribute("aria-label")).toBe("Hog coins: 28");
});

test("today's allowance is a row of kudos coins, used and left", () => {
  const host = render();
  const row = host.querySelector("[data-allowance]")!;
  expect(row.getAttribute("aria-label")).toBe("3 of 5 kudos left today");
  expect(row.querySelectorAll("[data-left]")).toHaveLength(3);
  expect(row.querySelectorAll("[data-used]")).toHaveLength(2);
});

test("this week's quests sit in the cabin, compact, with the way to the signpost; not while quests are off", () => {
  let host = render();
  const quests = section(host, "Quests this week")!;
  expect(quests.textContent).toContain("Clean sweep");
  expect(quests.querySelector("a[href='/quests']")?.textContent).toBe("Open the quest signpost");
  act(() => root?.unmount());
  asked.length = 0;
  host = render({ questsEnabled: false });
  expect(headings(host)).not.toContain("Quests this week");
  expect(asked).not.toContain("quests:mine");
});

test("the door: sign out, switch workspace when you have two, and the About text credits Hedgehog Mode", () => {
  const host = render({
    workspaces: [
      { memberId: "m1", name: "Lumen Labs", current: true },
      { memberId: "m9", name: "Side project", current: false },
    ],
  });
  const door = section(host, "The door")!;
  const leave = [...door.querySelectorAll("button")].find((b) => b.textContent === "Sign out")!;
  act(() => leave.click());
  expect(signOut).toHaveBeenCalled();
  const pick = door.querySelector<HTMLSelectElement>("select")!;
  expect([...pick.options].map((o) => o.textContent)).toEqual(["Lumen Labs", "Side project"]);
  expect(door.textContent).toContain("Hedgehog Mode by PostHog (MIT)");
});

test("with one workspace there is nothing to switch to", () => {
  const host = render();
  expect(section(host, "The door")!.querySelector("select")).toBeNull();
});

test("the game's switch hangs on the cabin wall, by the door", () => {
  game = { enabled: true, hidden: false, player: player(2), wallet: null };
  const host = render();
  const toggle = section(host, "The door")!.querySelector<HTMLButtonElement>("[role=switch]")!;
  expect(toggle.getAttribute("aria-label")).toBe("Show the game");
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  act(() => toggle.click());
  expect(mutate).toHaveBeenCalledWith({ hidden: true });
});

test("bot messages show what their event gained: a level-up under a kudos DM, and a gains DM labelled instead of a rarity", () => {
  overview.botMessages = [
    {
      _id: "n1",
      rarity: "rare",
      category: "receiver_success",
      text: "Ana sent you 1 🌮 in #general.",
      isNewDiscovery: false,
      at: Date.now(),
      gains: ["Level 2: Seedling. Your thoughtful kudos got you here."],
      gainLabel: "Level up",
    },
    { _id: "n2", rarity: "common", category: "gains", text: "Golden frame is yours.", isNewDiscovery: false, at: Date.now(), gainLabel: "New item" },
  ];
  const host = render({ questsEnabled: false });
  const items = [...section(host, "From the bot")!.querySelectorAll("li")].filter((li) => li.textContent?.includes("🌮") || li.textContent?.includes("Golden frame"));
  expect(items[0].textContent).toContain("Level 2: Seedling. Your thoughtful kudos got you here.");
  expect(items[0].textContent).toContain("Rare");
  expect(items[1].textContent).toContain("New item");
  expect(items[1].textContent).not.toContain("Common");
  overview.botMessages = [];
});
