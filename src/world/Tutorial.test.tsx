// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { MotionProvider } from "./motion";
import { onToasts } from "./toastBus";

/**
 * The tutorial in the world (#159, plan #152 S4): the HUD's checklist ("Next: feed the tree" and
 * why, opening the ten steps with the done ones ticked), the toast a completed step brings, and the
 * driver that completes a step the moment the server says it's met.
 */

let state: unknown;
let game: unknown;
let tree: unknown;
const advance = vi.fn(async (_args: unknown) => ({ completed: [] as { step: number; coins: number | null }[] }));
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(fn);
    return name === "tutorial:state" ? state : name === "game:mine" ? game : name === "tree:state" ? tree : undefined;
  },
  useMutation: () => advance,
}));

const { Checklist, tutorialToast } = await import("./Tutorial");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const progress = (level: number) => ({ level, title: "Seedling", xp: 40, floor: 30, next: 75, toNext: 35, fraction: 0.2 });
const mine = (level: number) => ({ enabled: true, hidden: false, player: progress(level), wallet: null, luckyCharms: 0, sunlamps: 0, lanterns: 0, look: { color: null, accessory: null } });
const on = (step: number, met = false) => ({ step, completedAt: Array.from({ length: step - 1 }, () => 1), met });

describe("the toast a completed step brings", () => {
  test("names the step, the coins from level 3, and what's next", () => {
    expect(tutorialToast([{ step: 3, coins: 5 }])).toEqual({
      kind: "tutorial",
      title: "Feed the tree: done",
      body: "+5 Hog coins. Next: look around.",
      link: { to: "/elder", label: "Ask the elder hog" },
    });
  });

  test("below level 3 the coins stay unsaid", () => {
    expect(tutorialToast([{ step: 1, coins: null }])).toMatchObject({ title: "Arrive: done", body: "Next: say thanks." });
  });

  test("several at once are counted, and the last step ends the chain", () => {
    expect(tutorialToast([{ step: 1, coins: 5 }, { step: 2, coins: 5 }])).toMatchObject({ title: "2 steps done", body: "+10 Hog coins. Next: feed the tree." });
    expect(tutorialToast([{ step: 10, coins: 5 }])).toEqual({ kind: "tutorial", title: "Together: done", body: "+5 Hog coins. That was the elder hog's last lesson." });
  });
});

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  game = mine(2);
  tree = { layout: { districts: [{ id: "base_camp", open: true }] } };
  advance.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const viewer = {
  workspaces: [],
  member: { _id: "m1", name: "Alex Rivera", isAdmin: true, gameHidden: false },
  workspace: { _id: "w1", name: "Lumen Labs", isDemo: true, gameEnabled: true, storeEnabled: true },
} as unknown as ReadyViewer;

function render() {
  act(() =>
    root.render(
      <MemoryRouter>
        <MotionProvider>
          <ViewerContext.Provider value={viewer}>
            <Checklist />
          </ViewerContext.Provider>
        </MotionProvider>
      </MemoryRouter>,
    ),
  );
}

describe("the checklist in the HUD", () => {
  test("says what's next and why", () => {
    state = on(3);
    render();
    const next = host.querySelector("[data-tutorial-next]")!;
    expect(next.textContent).toContain("Next: Feed the tree");
    expect(next.textContent).toContain("Your kudos wait at the tree as Hog coins until you offer them.");
  });

  test("opens the ten steps, the done ones ticked and the one you're on marked", () => {
    state = on(3);
    render();
    act(() => host.querySelector<HTMLButtonElement>("[data-tutorial-next]")!.click());
    const rows = [...host.querySelectorAll("[data-tutorial-step]")];
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Arrive"),
      expect.stringContaining("Say thanks"),
      expect.stringContaining("Feed the tree"),
      expect.stringContaining("Look around"),
      expect.stringContaining("Grow something"),
      expect.stringContaining("Learn"),
      expect.stringContaining("Trade"),
      expect.stringContaining("Explore"),
      expect.stringContaining("Settle"),
      expect.stringContaining("Together"),
    ]);
    expect(rows.map((r) => r.getAttribute("data-tutorial-step"))).toEqual(["done", "done", "current", "ahead", "ahead", "ahead", "ahead", "ahead", "ahead", "ahead"]);
    expect(host.querySelector("a[href='/elder']")?.textContent).toBe("Ask the elder hog");
  });

  test("a step waiting for a level says so, with the XP bar", () => {
    state = on(5);
    render();
    const next = host.querySelector("[data-tutorial-next]")!;
    expect(next.textContent).toContain("Next: Grow something, at level 3");
    expect(next.querySelector("[role='progressbar']")).not.toBeNull();
    game = mine(3);
    render();
    expect(host.querySelector("[data-tutorial-next] [role='progressbar']")).toBeNull();
  });

  test("gone once the chain is done, or without one", () => {
    state = on(11);
    render();
    expect(host.querySelector("[data-tutorial-next]")).toBeNull();
    state = null;
    render();
    expect(host.querySelector("[data-tutorial-next]")).toBeNull();
  });

  test("a step the server says is met completes at once, once, and its toast comes", async () => {
    const toasts: unknown[] = [];
    const stop = onToasts((t) => toasts.push(...t));
    advance.mockResolvedValueOnce({ completed: [{ step: 2, coins: null }] });
    state = on(2, true);
    render();
    render();
    await act(async () => {});
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith({});
    expect(toasts).toEqual([expect.objectContaining({ kind: "tutorial", title: "Say thanks: done" })]);
    stop();
  });
});
