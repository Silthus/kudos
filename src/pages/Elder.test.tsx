// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The elder hog's window (#159, plan #152 S4): PostHog's reading hoggie, and the step you're on as
 * one action and one sentence on why. Arriving there is step 1 of the chain.
 */

let state: unknown;
let game: unknown;
const advance = vi.fn(async (_args: unknown) => ({ completed: [] }));
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(fn);
    return name === "tutorial:state" ? state : name === "game:mine" ? game : name === "tree:state" ? { layout: { districts: [] } } : undefined;
  },
  useMutation: () => advance,
}));

const { Elder } = await import("./Elder");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mine = (level: number) => ({ enabled: true, hidden: false, player: { level, title: "Seedling", xp: 40, floor: 30, next: 75, toNext: 35, fraction: 0.2 }, wallet: null, luckyCharms: 0, sunlamps: 0, lanterns: 0, look: { color: null, accessory: null } });
const on = (step: number) => ({ step, due: false });

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  game = mine(2);
  advance.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(isDemo = true) {
  const viewer = {
    workspaces: [],
    member: { _id: "m1", name: "Alex Rivera", isAdmin: true, gameHidden: false },
    workspace: { _id: "w1", name: "Lumen Labs", isDemo, gameEnabled: true, storeEnabled: true, emojiGlyph: "🌱" },
  } as unknown as ReadyViewer;
  act(() =>
    root.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <Elder />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}

describe("the elder hog's window", () => {
  test("arriving is step 1: the window says so to the server, once", () => {
    state = on(1);
    render();
    render();
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith({ did: "arrive" });
    expect(host.querySelector("[data-npc]")).not.toBeNull();
  });

  test("says the step you're on: one action, one sentence on why, and where to do it", () => {
    state = on(3);
    render();
    const step = host.querySelector("[data-elder-step]")!;
    expect(step.textContent).toContain("Step 3 of 10");
    expect(step.textContent).toContain("Feed the tree");
    expect(step.textContent).toContain("Your kudos wait at the tree as Hog coins until you offer them.");
    expect(step.querySelector("a")?.getAttribute("href")).toBe("/offering");
    expect(step.querySelector("a")?.textContent).toBe("Offer your appreciation at the offering stone");
    expect(advance).not.toHaveBeenCalled();
  });

  test("in the demo the first kudos is given in the sandbox; in a real workspace, in Slack", () => {
    state = on(2);
    render(true);
    expect(host.querySelector("[data-elder-step] a")?.getAttribute("href")).toBe("/playground");
    render(false);
    expect(host.querySelector("[data-elder-step] a")).toBeNull();
    expect(host.querySelector("[data-elder-step]")!.textContent).toContain("In Slack: @name 🌱 and a few words on why.");
  });

  test("a step waiting for a level says which, with the XP bar, and no way in yet", () => {
    state = on(6);
    render();
    const step = host.querySelector("[data-elder-step]")!;
    expect(step.textContent).toContain("At level 4");
    expect(step.querySelector("[role='progressbar']")).not.toBeNull();
    expect(step.querySelector("a")).toBeNull();
  });

  test("once the chain is done, the elder hog has nothing more to teach", () => {
    state = on(11);
    render();
    expect(host.querySelector("[data-elder-step]")).toBeNull();
    expect(host.textContent).toContain("You know the way now.");
  });
});
