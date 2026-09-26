// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MotionGlobalConfig } from "motion/react";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { workspaceClockNow } from "@/lib/format";
import { copyProblems } from "@/testing/windowPage";
import { escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";

/**
 * The simulator in the world (#144): while you're in your simulator, the HUD carries its clock (the
 * day, Next day, Next week, Simulate levels), a move of the clock tells what it brought as the
 * world's toasts one at a time, the fast-forward window follows the bot's run to its summary, and
 * the Places list, the caption and the workspace switcher say where you are.
 */

let queries: Record<string, unknown> = {};
const calls: Record<string, ReturnType<typeof vi.fn>> = {};
const replies: Record<string, unknown> = {};
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (fn: never, args: unknown) => (args === "skip" ? undefined : queries[getFunctionName(fn)]),
    useMutation: (fn: never) => {
      const name = getFunctionName(fn);
      calls[name] ??= vi.fn(async () => replies[name]);
      return calls[name];
    },
  };
});
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }) }));
vi.mock("@/components/cosmetics", () => ({ SuperKudosCelebration: () => null }));
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { WorldShell } = await import("./WorldShell");
MotionGlobalConfig.skipAnimations = true;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const DAY = 24 * 60 * 60 * 1000;
const workspaces = [
  { memberId: "m1", slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", current: false },
  { memberId: "sim1", slackTeamId: "SIM-1-abc", name: "Simulator", current: true },
];
const inSimulator = {
  workspaces,
  member: { _id: "sim1", name: "Alex Rivera", isAdmin: true, gameHidden: false },
  workspace: { _id: "wsim", name: "Simulator", isDemo: true, timezone: "Europe/Berlin", gameEnabled: true, storeEnabled: true, questsEnabled: true, clockOffsetMs: 3 * DAY },
} as unknown as ReadyViewer;
const inDemo = {
  ...inSimulator,
  workspaces: workspaces.map((w) => ({ ...w, current: w.memberId === "m1" })),
  member: { _id: "m1", name: "Alex Rivera", isAdmin: false, gameHidden: false },
  workspace: { ...inSimulator.workspace, _id: "wdemo", name: "Lumen Labs", clockOffsetMs: 0 },
} as unknown as ReadyViewer;

const summary = {
  daysPlayed: 7,
  kudosGiven: 35,
  thoughtfulKudos: 35,
  questsCompleted: { weekly: 6, daily: 3, sweeps: 2 },
  coinsEarned: 91,
  fruitPicked: 4,
  plantsPlanted: 1,
  levelsGained: 2,
  newConnections: 12,
};
const run = (over: Record<string, unknown> = {}) => ({ _id: "run1", status: "running", fromLevel: 7, toLevel: 10, stopReason: null, summary, levelDays: [], ...over });
const state = (over: Record<string, unknown> = {}) => ({ active: true, shown: true, level: 7, xp: 900, day: "2026-10-14", dayIndex: 2, clockOffsetMs: 3 * DAY, lastRun: null, ...over });

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  queries = { "simulator:state": state() };
  for (const k of Object.keys(calls)) delete calls[k];
  for (const k of Object.keys(replies)) delete replies[k];
  window.innerWidth = 1280;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function open(as: ReadyViewer = inSimulator) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <ViewerContext.Provider value={as}>
          <Routes>
            <Route element={<WorldShell />}>
              <Route index element={null} />
            </Route>
          </Routes>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}
const clock = () => document.querySelector<HTMLElement>("[data-simulator-clock]");
const button = (name: string, within: ParentNode = document) => [...within.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === name);
const click = async (name: string, within: ParentNode = document) => {
  const b = button(name, within);
  if (!b) throw new Error(`no button ${name}`);
  await act(async () => b.click());
};
const toast = () => document.querySelector("[aria-live='polite'] [data-toast]");
const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open][aria-label='Simulate levels'], dialog[open]");

describe("the HUD clock", () => {
  test("in your simulator the HUD shows the simulated day with Next day, Next week and Simulate levels", () => {
    open();
    const c = clock()!;
    expect(c.textContent).toContain("Day 3, Wednesday 14 Oct");
    expect([...c.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual(["Next day", "Next week", "Simulate levels"]);
    expect(copyProblems(c)).toEqual([]);
    // Checked from outside the note, so its own parchment face counts.
    expect(parchmentTextOnDusk(c.parentElement!)).toEqual([]);
    // Top right, by the Places button, on a desktop.
    expect(c.closest("[data-hud-top-right]")).not.toBeNull();
  });

  test("no clock in the shared demo, nor for anyone without a simulator", () => {
    queries["simulator:state"] = state({ shown: false });
    open(inDemo);
    expect(clock()).toBeNull();
    queries["simulator:state"] = { active: false };
    open(inDemo);
    expect(clock()).toBeNull();
  });

  test("Next day and Next week move the clock; what they brought comes as toasts, one at a time", async () => {
    replies["simulator:advance"] = { day: "2026-10-19", dayIndex: 7, changes: ["Monday: your 5 kudos for today are back.", "A new week: a new quest board.", "Your plant for Ana Costa grew: Sapling."] };
    open();
    await click("Next week");
    expect(calls["simulator:advance"]).toHaveBeenCalledWith({ days: 7 });
    expect(toast()?.textContent).toContain("Day 8, Monday 19 Oct");
    expect(toast()?.textContent).toContain("Monday: your 5 kudos for today are back.");
    expect(document.querySelectorAll("[data-toast]")).toHaveLength(1);
    await click("Dismiss");
    expect(toast()?.textContent).toContain("A new week: a new quest board.");
    expect(toast()?.querySelector("a")?.getAttribute("href")).toBe("/quests");
    await click("Dismiss");
    expect(toast()?.textContent).toContain("Your plant for Ana Costa grew: Sapling.");
    await click("Next day");
    expect(calls["simulator:advance"]).toHaveBeenLastCalledWith({ days: 1 });
  });

  test("a refused move says why, in the clock", async () => {
    const { ConvexError } = await import("convex/values");
    open();
    calls["simulator:advance"].mockRejectedValueOnce(new ConvexError("A fast-forward is playing: wait for it or abort it first."));
    await click("Next day");
    expect(clock()!.querySelector("[role=alert]")?.textContent).toBe("A fast-forward is playing: wait for it or abort it first.");
  });

  test("the page's times read on the simulator's clock", () => {
    open();
    expect(Math.abs(workspaceClockNow() - (Date.now() + 3 * DAY))).toBeLessThan(1000);
    open(inDemo);
    expect(Math.abs(workspaceClockNow() - Date.now())).toBeLessThan(1000);
  });
});

describe("the fast-forward window", () => {
  test("Simulate levels opens a window that fast-forwards the levels you pick, up to the top", async () => {
    open();
    await click("Simulate levels");
    const d = dialog()!;
    expect(d.textContent).toContain("Simulate levels");
    const levels = d.querySelector<HTMLSelectElement>("select")!;
    // From level 7 there are 18 levels left to play.
    expect([...levels.options].map((o) => o.value)).toEqual(Array.from({ length: 18 }, (_, i) => String(i + 1)));
    await act(async () => {
      levels.value = "3";
      levels.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Fast-forward 3 levels", d);
    expect(calls["simulator:fastForward"]).toHaveBeenCalledWith({ levels: 3 });
    expect(copyProblems(d)).toEqual([]);
  });

  test("while the bot plays, the window shows its progress and can abort it; the clock waits", async () => {
    queries["simulator:state"] = state({ level: 8, lastRun: run({ summary: { ...summary, daysPlayed: 4 } }) });
    open();
    expect(button("Next day", clock()!)?.disabled).toBe(true);
    await click("Simulate levels");
    const d = dialog()!;
    expect(d.textContent).toContain("Level 8 of 10");
    expect(d.textContent).toContain("4 days played");
    expect(d.querySelector("[role=progressbar], .pixel-meter")).not.toBeNull();
    await click("Abort", d);
    expect(calls["simulator:abort"]).toHaveBeenCalled();
  });

  test("when the run is done, the window shows the summary ledger with a row per level", async () => {
    queries["simulator:state"] = state({
      level: 10,
      lastRun: run({ status: "done", levelDays: [{ level: 8, days: 3 }, { level: 9, days: 2 }, { level: 10, days: 2 }] }),
    });
    open();
    await click("Simulate levels");
    const ledger = dialog()!.querySelector("[data-ledger]")!;
    const rows = [...ledger.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent?.trim()));
    expect(rows).toEqual(
      expect.arrayContaining([
        ["Days played", "7"],
        ["Kudos given", "35, all thoughtful"],
        ["Quests", "6 weekly, 3 daily, 2 clean sweeps"],
        ["Hog coins earned", "91"],
        ["Fruit picked", "4"],
        ["Plants planted", "1"],
        ["New connections", "12"],
        ["Level 8", "3 days"],
        ["Level 9", "2 days"],
        ["Level 10", "2 days"],
      ]),
    );
    expect(copyProblems(dialog()!)).toEqual([]);
    expect(parchmentTextOnDusk(dialog()!)).toEqual([]);
  });

  test("an aborted run's summary says it was stopped", async () => {
    queries["simulator:state"] = state({ level: 8, lastRun: run({ status: "aborted", summary: { ...summary, daysPlayed: 3 } }) });
    open();
    await click("Simulate levels");
    expect(dialog()!.textContent).toContain("You stopped it after 3 days");
  });

  test("review: the summary points to the elder oak for the skill points the levels brought, and going there closes the window", async () => {
    queries["simulator:state"] = state({ level: 10, lastRun: run({ status: "done", summary: { ...summary, levelsGained: 3 } }) });
    open();
    await click("Simulate levels");
    const link = [...dialog()!.querySelectorAll("a")].find((a) => a.textContent === "Go to the elder oak")!;
    expect(dialog()!.textContent).toContain("3 new skill points");
    expect(link.getAttribute("href")).toBe("/skills");
    await act(async () => link.click());
    expect(document.querySelector("dialog[open]")).toBeNull();
  });
});

const game = (level: number, xp: number, coins: number) => ({
  enabled: true,
  hidden: false,
  player: { level, title: "Gardener", xp, floor: 0, next: null, toNext: 0, fraction: 1 },
  wallet: { balance: coins, fromKudos: coins, fromFruit: 0, fromQuests: 0, fromSprees: 0, fromLevels: 0, spent: 0, adjusted: 0 },
});

describe("review: the fast-forward window, corner cases", () => {
  test("a stopped run's reason reads as one sentence", async () => {
    queries["simulator:state"] = state({ level: 9, lastRun: run({ status: "stopped", stopReason: "Still short of level 10 after 500 days." }) });
    open();
    await click("Simulate levels");
    const text = dialog()!.textContent!;
    expect(text).toContain("Still short of level 10 after 500 days.");
    expect(text).not.toContain("..");
  });

  test("a run that starts while the window shows the picker takes over the window", async () => {
    open();
    await click("Simulate levels");
    expect(button("Fast-forward 3 levels", dialog()!)).toBeDefined();
    queries["simulator:state"] = state({ lastRun: run() });
    open();
    expect(dialog()!.textContent).toContain("Level 7 of 10");
    expect(button("Fast-forward 3 levels", dialog()!)).toBeUndefined();
  });

  test("the meter follows XP, so a one-level run moves before the level comes", async () => {
    // Level 7 starts at 900 XP and level 8 at 1,250 (lib/xp.ts, worked by hand).
    queries["simulator:state"] = state({ level: 7, xp: 1000, lastRun: run({ toLevel: 8 }) });
    open();
    await click("Simulate levels");
    const meter = dialog()!.querySelector("[role=progressbar]")!;
    expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["100", "350"]);
  });

  test("at the top level there's nothing to simulate, and the clock says so in words", () => {
    queries["simulator:state"] = state({ level: 25 });
    open();
    expect(button("Simulate levels", clock()!)).toBeUndefined();
    expect(clock()!.textContent).toContain("top level");
  });

  test("a playing run points to Abort, in case it seems stuck", () => {
    queries["simulator:state"] = state({ lastRun: run() });
    open();
    expect(clock()!.textContent).toContain("abort it under Simulate levels");
  });
});

describe("review: while the bot plays, the world holds its celebrations", () => {
  test("no toast per simulated day; one level-up toast for the whole run when it ends", async () => {
    queries["game:mine"] = game(7, 900, 100);
    queries["me:today"] = { discovered: 10 };
    queries["simulator:state"] = state({ lastRun: run() });
    open();
    queries["game:mine"] = game(8, 1300, 130);
    queries["me:today"] = { discovered: 12 };
    open();
    queries["game:mine"] = game(9, 1700, 160);
    open();
    expect(toast()).toBeNull();
    queries["simulator:state"] = state({ level: 9, lastRun: run({ status: "done" }) });
    open();
    expect(toast()?.textContent).toContain("Level 9");
    expect(toast()?.textContent).toContain("+2 skill points");
    await click("Dismiss");
    expect(toast()?.textContent).toContain("2 new messages discovered");
    await click("Dismiss");
    expect(toast()).toBeNull();
  });
});

describe("review: signposts before the state arrives, and outside the demo", () => {
  test("a cold load inside the simulator never says Live demo", () => {
    delete queries["simulator:state"];
    open();
    expect(host.textContent).not.toContain("Live demo.");
    expect(host.textContent).toContain("Simulator.");
  });

  test("a real Slack workspace never asks for a simulator, and has no clock", () => {
    const real = { ...inDemo, workspaces: [], workspace: { ...inDemo.workspace, isDemo: false } } as unknown as ReadyViewer;
    open(real);
    expect(clock()).toBeNull();
  });

  test("between phone and desktop (700 px) the clock stays at the bottom, clear of the toasts", () => {
    window.innerWidth = 700;
    open();
    expect(clock()!.closest("[data-hud-caption]")).not.toBeNull();
  });
});

describe("review: clock toasts", () => {
  test("a new move of the clock replaces what the last one still had to say", async () => {
    replies["simulator:advance"] = { day: "2026-10-19", dayIndex: 7, changes: ["Monday: your 5 kudos for today are back.", "A new week: a new quest board."] };
    open();
    await click("Next week");
    expect(toast()?.textContent).toContain("Day 8, Monday 19 Oct");
    replies["simulator:advance"] = { day: "2026-10-20", dayIndex: 8, changes: ["Tuesday: your 5 kudos for today are back."] };
    await click("Next day");
    expect(toast()?.textContent).toContain("Tuesday: your 5 kudos for today are back.");
    await click("Dismiss");
    expect(toast()).toBeNull();
  });
});

describe("signposts", () => {
  test("the caption and the Places list say Simulator, day N, and the switcher Simulator (level N)", async () => {
    open();
    expect(host.textContent).toContain("Simulator, day 3");
    expect(host.textContent).not.toContain("Live demo.");
    await click("Places");
    expect(document.querySelector("nav[aria-label='Places'] [data-hud-menu]")?.textContent).toContain("Simulator, day 3");
    await click("Settings");
    const options = [...document.querySelectorAll("[data-hud-menu] select option")].map((o) => o.textContent);
    expect(options).toEqual(["Lumen Labs", "Simulator (level 7)"]);
  });

  test("in the shared demo, the demo line stays", () => {
    queries["simulator:state"] = state({ shown: false });
    open(inDemo);
    expect(host.textContent).toContain("Live demo.");
  });
});

describe("on a phone (390 px)", () => {
  test("the clock sits above the caption at the bottom, clear of the toasts under your corner, and nothing widens the screen", () => {
    window.innerWidth = 390;
    open();
    const c = clock()!;
    expect(c.closest("[data-hud-top-right]")).toBeNull();
    expect(c.closest("[data-hud-caption]")).not.toBeNull();
    expect(widensSideways(document.body)).toEqual([]);
    expect(escapesFromScrollers(c)).toEqual([]);
  });

  test("the fast-forward window fits the phone", async () => {
    window.innerWidth = 390;
    queries["simulator:state"] = state({ level: 10, lastRun: run({ status: "done", levelDays: [{ level: 8, days: 3 }] }) });
    open();
    await click("Simulate levels");
    expect(widensSideways(dialog()!)).toEqual([]);
    expect(escapesFromScrollers(dialog()!)).toEqual([]);
  });
});
