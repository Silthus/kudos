// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * A ruin's window (#162, plan #152 S7): at the entrance, the way in (one stamina, level 6); inside,
 * the room strip, the room's pixel scene, the party's and the foe's meters, the choices with the
 * stat each uses, a puzzle's options (two struck out when your wits see through it), the log, and
 * at the end the results ledger.
 */

let current: unknown;
const tree = { layout: { ruins: [{ id: "ruin:1:2", name: "The Salt Well", tier: 1, at: { x: 60, y: 3 } }, { id: "ruin:2:0", name: "The Amber Vault", tier: 2, at: { x: 110, y: 3 } }] } };
const start = vi.fn();
const actOn = vi.fn();
const abandon = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "rpg:current": current, "tree:state": tree })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) => ({ "rpg:start": start, "rpg:act": actOn, "rpg:abandon": abandon })[getFunctionName(fn)],
}));

// No atlas in tests: your hedgehog in the scene keeps its placeholder.
vi.mock("@/world/atlas", async (real) => ({ ...(await real<typeof import("@/world/atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { Expedition } = await import("./Expedition");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  start.mockReset();
  actOn.mockReset();
  abandon.mockReset();
});

const viewer = { member: { _id: "m_ana", name: "Ana" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;

function render(path = "/ruins/1-2") {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={viewer}>
          <div data-window-body className="@container pixel-frame">
            <Routes>
              <Route path="/ruins/:ruinId" element={<Expedition />} />
            </Routes>
          </div>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const text = () => document.body.textContent ?? "";
const button = (name: RegExp) => [...document.querySelectorAll("button")].find((b) => name.test(b.textContent ?? ""));

const party = [{ memberId: "m_ana", name: "Ana", hp: 9, maxHp: 18, stats: { might: 9, wits: 4, heart: 2 } }];
const run = (patch: Record<string, unknown> = {}) => ({
  id: "e1",
  ruinId: "ruin:1:2",
  name: "The Salt Well",
  tier: 1,
  open: true,
  state: "open",
  room: 0,
  rooms: [{ kind: "foe", foe: "sand_scarab" }, { kind: "unknown" }, { kind: "unknown" }, { kind: "unknown" }],
  turn: 1,
  foe: { id: "sand_scarab", name: "Sand scarab", about: "Armoured, slow, and everywhere.", hp: 7, maxHp: 16, weakness: "might" },
  party,
  puzzle: null,
  log: [{ room: 0, line: "Ana strikes the Sand scarab for 9." }, { room: 0, line: "The Sand scarab hits Ana for 2." }],
  loot: { coins: 0, fruits: [], gear: [], lore: [] },
  ...patch,
});

describe("at the entrance", () => {
  test("says the ruin's name and goes in for one stamina", () => {
    current = { stamina: 2, level: 9, run: null };
    render();
    expect(text()).toContain("The Salt Well");
    expect(document.querySelector("[data-stamina='2']")).not.toBeNull();
    act(() => button(/Enter the ruin/)!.click());
    expect(start).toHaveBeenCalledWith({ ruinId: "ruin:1:2" });
  });

  test("without stamina, or below level 6, says how to get there instead", () => {
    current = { stamina: 0, level: 9, run: null };
    render();
    expect(button(/Enter the ruin/)?.disabled).toBe(true);
    expect(text()).toMatch(/thoughtful kudos you give restores one/);
    current = { stamina: 3, level: 5, run: null };
    render();
    expect(button(/Enter the ruin/)?.disabled).toBe(true);
    expect(text()).toMatch(/level 6/);
  });

  test("a far ruin waits for parties", () => {
    current = { stamina: 3, level: 12, run: null };
    render("/ruins/2-0");
    expect(button(/Enter the ruin/)).toBeUndefined();
    expect(text()).toMatch(/parties/);
  });
});

describe("in a room", () => {
  test("a foe: the scene, both meters, the log, and choices naming the stat they use", async () => {
    current = { stamina: 1, level: 9, run: run() };
    render();
    expect(document.querySelector("[data-room-strip] [data-room='0'][aria-current='step']")).not.toBeNull();
    expect(document.querySelector("[data-room='1']")!.getAttribute("aria-label")).toBe("Room 2: not reached yet");
    expect(document.querySelector("[data-creature-art='sand_scarab']")).not.toBeNull();
    expect(document.querySelector("[role='progressbar'][aria-label='Sand scarab: 7 of 16']")).not.toBeNull();
    expect(document.querySelector("[role='progressbar'][aria-label='Ana: 9 of 18']")).not.toBeNull();
    expect(text()).toContain("The Sand scarab hits Ana for 2.");
    expect(button(/Strike/)!.textContent).toMatch(/might 9/);
    expect(button(/Outwit/)!.textContent).toMatch(/wits 4/);
    expect(button(/Calm/)!.textContent).toMatch(/heart 2/);
    await act(async () => button(/Strike/)!.click());
    expect(actOn).toHaveBeenCalledWith({ choice: { kind: "strike" } });
    // Leaving asks once: the run ends, and what earlier rooms gave is kept.
    await act(async () => button(/Return to camp/)!.click());
    expect(abandon).not.toHaveBeenCalled();
    expect(text()).toContain("You keep what earlier rooms gave");
    await act(async () => button(/Return to camp/)!.click());
    expect(abandon).toHaveBeenCalled();
  });

  test("a puzzle: the question, its options, those struck out or answered wrong closed", () => {
    current = {
      stamina: 1,
      level: 9,
      run: run({
        room: 1,
        rooms: [{ kind: "foe", foe: "sand_scarab" }, { kind: "puzzle" }, { kind: "unknown" }, { kind: "unknown" }],
        foe: null,
        log: [],
        puzzle: { question: "Who thanked Cleo in the last week?", options: ["Ana", "Ben", "Dan", "Eve", "Finn"].map((label, i) => ({ label, struck: i === 0 || i === 3, tried: i === 4 })), triesLeft: 3, hint: true },
      }),
    };
    render();
    expect(text()).toContain("Who thanked Cleo in the last week?");
    expect(text()).toMatch(/Your wits rule out/);
    expect(button(/^Dan$/)!.disabled).toBe(false);
    expect(button(/^Eve/)!.disabled).toBe(true);
    expect(button(/^Finn/)!.disabled).toBe(true); // answered wrong already
    act(() => button(/^Ben$/)!.click());
    expect(actOn).toHaveBeenCalledWith({ choice: { kind: "answer", option: 1 } });
  });

  test("a rest heals, and the party moves on", () => {
    current = { stamina: 1, level: 9, run: run({ room: 2, rooms: [{ kind: "foe", foe: "sand_scarab" }, { kind: "puzzle" }, { kind: "rest" }, { kind: "unknown" }], foe: null, log: [{ room: 2, line: "The party rests." }] }) };
    render();
    expect(text()).toContain("The party rests.");
    act(() => button(/Move on/)!.click());
    expect(actOn).toHaveBeenCalledWith({ choice: { kind: "onward" } });
  });
});

describe("the end of a run", () => {
  test("the results ledger: coins, fruit, gear and a secret", () => {
    current = {
      stamina: 1,
      level: 9,
      run: run({ open: false, state: "cleared", room: 3, loot: { coins: 12, fruits: ["sun"], gear: [{ id: "scout_cap", name: "Scout's cap" }], lore: [{ lore: 0, title: "The first thank-you" }] } }),
    };
    render();
    expect(document.querySelector("[data-results='cleared']")).not.toBeNull();
    expect(text()).toContain("12 Hog coins");
    expect(text()).toContain("Scout's cap");
    expect(text()).toContain("The first thank-you");
    expect(button(/Enter the ruin again/)).toBeDefined();
  });
});
