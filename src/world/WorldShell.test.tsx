// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { parchmentTextOnDusk } from "@/testing/layout";

let queries: Record<string, unknown> = {};
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return { useQuery: (fn: never, args: unknown) => (args === "skip" ? undefined : queries[getFunctionName(fn)]), useMutation: () => vi.fn() };
});
let reduced = false;
vi.mock("motion/react", async (real) => ({ ...(await real<typeof import("motion/react")>()), useReducedMotion: () => reduced }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }) }));
// The Super kudos celebration: a modal of its own, while one waits.
let celebrating = false;
vi.mock("@/components/cosmetics", () => ({
  SuperKudosCelebration: () => (celebrating ? <div role="dialog" aria-modal="true" aria-label="A Super kudos" /> : null),
}));
// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { WorldShell } = await import("./WorldShell");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const viewer = {
  workspaces: [],
  member: { _id: "m1", name: "Alex Rivera", isAdmin: false, gameHidden: false },
  workspace: { name: "Lumen Labs", isDemo: false, gameEnabled: true, storeEnabled: true, questsEnabled: true },
} as unknown as ReadyViewer;

let url = "";
function Probe() {
  const l = useLocation();
  url = l.pathname + l.search + l.hash;
  return null;
}
const page = (name: string, extra?: React.ReactNode) => (
  <div>
    <h1 className="text-ink">{name}</h1>
    {extra}
  </div>
);

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  queries = {};
  reduced = false;
  celebrating = false;
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function open(path: string) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={viewer}>
          <Routes>
            <Route element={<WorldShell />}>
              <Route index element={null} />
              <Route path="/me" element={page("Me", <Link to="/quests">This week's quests</Link>)} />
              <Route path="/quests" element={page("Quests")} />
              <Route path="/store" element={page("Store")} />
              <Route path="/garden" element={page("Garden")} />
              <Route path="/garden/:memberId" element={page("Their garden")} />
              <Route path="/leaderboard" element={page("Leaderboard")} />
            </Route>
          </Routes>
          <Probe />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}

const openWindow = () => document.querySelector<HTMLDialogElement>("dialog[open]");
const windowTitle = () => {
  const d = openWindow();
  return d ? document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent : null;
};
const caption = () => host.textContent?.match(/You.re at: ([^.]*?)(Walk|$)/)?.[1]?.trim();
const walkFor = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  });

describe("the world and its windows follow the URL", () => {
  test("the map itself has no window, and you start in your garden", () => {
    open("/");
    expect(openWindow()).toBeNull();
    expect(caption()).toBe("Your garden");
    expect(host.querySelector("canvas[data-world]")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("a deep link lands at the place's door with its window open, no walk", () => {
    open("/quests");
    expect(windowTitle()).toBe("Quest signpost");
    expect(openWindow()!.textContent).toContain("Quests");
    expect(caption()).toBe("Quest signpost");
    // Page copy written for parchment sits on the window's parchment.
    expect(parchmentTextOnDusk(openWindow()!)).toEqual([]);
  });

  test("the store opens from a link while it's locked and not on the map yet", () => {
    open("/store");
    expect(windowTitle()).toBe("The store stall");
  });

  test("closing the window goes back to the map, the hedgehog staying at the door", () => {
    open("/quests");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
    expect(caption()).toBe("Quest signpost");
  });

  test("a link inside a window walks you there first, then opens that place", () => {
    open("/me");
    expect(windowTitle()).toBe("Your cabin");
    act(() => openWindow()!.querySelector("a")!.click());
    expect(url).toBe("/quests");
    // On the way: no window yet.
    expect(openWindow()).toBeNull();
    walkFor(4000);
    expect(windowTitle()).toBe("Quest signpost");
    expect(caption()).toBe("Quest signpost");
  });
});

describe("walking with the keys", () => {
  test("a step off the garden square and back in opens your garden", () => {
    open("/");
    press("ArrowUp");
    walkFor(400);
    // Off the square, on the garden's own path: still in your garden, nothing opens.
    expect(caption()).toBe("Your garden");
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
    press("s");
    walkFor(400);
    expect(url).toBe("/garden");
    expect(windowTitle()).toBe("Your garden");
  });

  test("a key tapped while a step is under way is the next step, not lost", () => {
    open("/");
    press("ArrowUp");
    walkFor(40);
    press("s");
    walkFor(800);
    // Up off the square and straight back onto it: in through the gate, so the garden opens.
    expect(url).toBe("/garden");
  });

  test("shuffling between the square's tiles doesn't open it", () => {
    open("/");
    press("ArrowRight");
    walkFor(400);
    expect(openWindow()).toBeNull();
    expect(url).toBe("/");
  });

  test("keys don't walk while a window is open", () => {
    open("/quests");
    press("ArrowUp");
    walkFor(400);
    expect(url).toBe("/quests");
    expect(windowTitle()).toBe("Quest signpost");
  });
});

describe("walks that change their mind", () => {
  test("under reduced motion a link inside a window opens the next place at once", () => {
    reduced = true;
    open("/me");
    act(() => openWindow()!.querySelector("a")!.click());
    walkFor(50);
    expect(url).toBe("/quests");
    expect(windowTitle()).toBe("Quest signpost");
  });

  test("clicking another place on the way there goes there instead, and opens it", () => {
    open("/me");
    act(() => openWindow()!.querySelector("a")!.click());
    walkFor(300);
    act(() => host.querySelector<HTMLElement>("[data-sign=leaderboard]")!.click());
    expect(url).toBe("/");
    walkFor(4000);
    expect(url).toBe("/leaderboard");
    expect(windowTitle()).toBe("Notice board");
  });

  test("clicking the same place on the way there still opens it", () => {
    open("/me");
    act(() => openWindow()!.querySelector("a")!.click());
    walkFor(300);
    act(() => host.querySelector<HTMLElement>("[data-sign=quests]")!.click());
    walkFor(4000);
    expect(url).toBe("/quests");
    expect(windowTitle()).toBe("Quest signpost");
  });

  test("a key on the way there stops the walk and leaves the place's URL for the map", () => {
    open("/me");
    act(() => openWindow()!.querySelector("a")!.click());
    walkFor(300);
    press("ArrowUp");
    walkFor(4000);
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
  });
});

describe("a Super kudos celebration", () => {
  test("waits for the map: it never shows under a window", () => {
    celebrating = true;
    open("/quests");
    expect(host.querySelector("[aria-label='A Super kudos']")).toBeNull();
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(host.querySelector("[aria-label='A Super kudos']")).not.toBeNull();
  });

  test("holds the hedgehog still while it's up", () => {
    celebrating = true;
    open("/");
    press("ArrowUp");
    walkFor(400);
    press("s");
    walkFor(400);
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
  });
});

describe("a teammate's bed", () => {
  const ring = [{ memberId: "m7", name: "Ana", plants: 3, top: { species: "helpful_oak", stage: "grown" } }];

  test("a deep link to their garden stands you at their bed, and says so", () => {
    queries = { "gardens:neighbours": ring };
    open("/garden/m7");
    expect(windowTitle()).toBe("Ana's garden");
    expect(caption()).toBe("Ana's bed");
  });

  test("back on the map at their bed, a bubble says whose it is, what grows there, and invites you in", () => {
    queries = { "gardens:neighbours": ring };
    open("/garden/m7");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    const bubble = host.querySelector("[data-neighbour-bubble]")!;
    expect(bubble.textContent).toContain("Ana's bed");
    expect(bubble.textContent).toContain("3 plants");
    expect(bubble.querySelector("a")!.getAttribute("href")).toBe("/garden/m7");
    expect(bubble.querySelector("a")!.textContent).toBe("Visit garden");
  });
});

describe("your plots", () => {
  const plant = { plot: 0, forId: "m7", forName: "Ana", stage: "sprout", species: "helpful_oak", dormant: false, fruit: [], goldenLeaves: 0, lastWatered: "2026-01-01" };
  const mine = (plots: number) => ({ open: true, plots, candidates: [], plants: [plant] });
  const keys = (...ks: string[]) => ks.forEach((k) => (press(k), walkFor(400)));

  test("walking onto one of your plots opens it in the garden window", () => {
    queries = { "gardens:mine": mine(2) };
    open("/");
    keys("d", "s", "s", "d"); // out of the middle square, down the path, onto the first key bed
    expect(url).toBe("/garden?plot=0");
    expect(windowTitle()).toBe("Your garden");
  });

  test("a plot that isn't yours yet is lawn: walking onto it opens nothing", () => {
    queries = { "gardens:mine": mine(1) };
    open("/");
    keys("d", "s", "d", "d", "d", "s"); // along the path to the second plot
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
  });

  test("a link to a plot stands you on it with the garden window open", () => {
    queries = { "gardens:mine": mine(2) };
    open("/garden?plot=1");
    expect(windowTitle()).toBe("Your garden");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(url).toBe("/");
    keys("a", "d"); // off the plot and back on
    expect(url).toBe("/garden?plot=1");
  });

  test("a link to a plot, opened before your garden has loaded, still lands on the plot without a walk (review #2)", () => {
    queries = {};
    open("/garden?plot=1");
    expect(openWindow()).toBeNull(); // waiting for the garden, not at its gate
    queries = { "gardens:mine": mine(2) };
    open("/garden?plot=1"); // the garden arrives
    expect(windowTitle()).toBe("Your garden"); // at once: no walk
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    keys("a", "d");
    expect(url).toBe("/garden?plot=1");
  });
});

test("a teammate's garden from a link names them in the title, even when they're not in your ring (review #8)", () => {
  queries = { "gardens:of": { name: "Zoe", avatarUrl: null, plants: [] } };
  open("/garden/m9");
  expect(windowTitle()).toBe("Zoe's garden");
});
