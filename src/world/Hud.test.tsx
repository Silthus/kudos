// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { navItems } from "@/lib/nav";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { visiblePlaces } from "./places";

let game: unknown;
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "game:mine" ? game : undefined),
  useMutation: () => vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }) }));
// No atlas in tests: the portrait keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { Hud, hudGame } = await import("./Hud");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const player = (level: number) => ({ level, title: level >= 9 ? "Gardener" : "Seedling", xp: 1650, floor: 1500, next: 1900, toNext: 250, fraction: 0.4 });
const wallet = { balance: 84, fromKudos: 84, fromFruit: 0, fromQuests: 0, fromSprees: 0, fromLevels: 0, spent: 0, adjusted: 0 };
const mine = (patch: Record<string, unknown>) => ({ enabled: true, hidden: false, player: player(9), wallet, luckyCharms: 0, sunlamps: 0, lanterns: 0, ...patch });

describe("what the HUD shows of your game", () => {
  test("level, title, XP and coins from level 3", () => {
    expect(hudGame(mine({}) as never)).toMatchObject({ level: 9, title: "Gardener", xp: 1650, coins: 84 });
  });

  test("below level 3 no coins, not even a zero", () => {
    expect(hudGame(mine({ player: player(2), wallet: null }) as never)).toMatchObject({ level: 2, coins: null });
    // Even if a wallet came along, the level-3 rule holds.
    expect(hudGame(mine({ player: player(2) }) as never)?.coins).toBeNull();
  });

  test("nothing while the game is off, hidden, not started or loading: then just your name", () => {
    expect(hudGame(mine({ enabled: false }) as never)).toBeNull();
    expect(hudGame(mine({ hidden: true }) as never)).toBeNull();
    expect(hudGame(mine({ player: null, wallet: null }) as never)).toBeNull();
    expect(hudGame(undefined)).toBeNull();
  });
});

let root: Root;
let host: HTMLElement;
let url = "";
function Probe() {
  const l = useLocation();
  url = l.pathname + l.search;
  return null;
}
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const viewer = {
  workspaces: [],
  member: { _id: "m1", name: "Alex Rivera", isAdmin: true, gameHidden: false },
  workspace: { name: "Lumen Labs", isDemo: false, gameEnabled: true, storeEnabled: true },
} as unknown as ReadyViewer;

function render() {
  const places = visiblePlaces(navItems({ isAdmin: true, isDemo: false, storeEnabled: true, gameShown: true, openRequests: 2 }));
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <ViewerContext.Provider value={viewer}>
          <Hud places={places} where="Your garden" />
          <Probe />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}

describe("the HUD", () => {
  test("shows your level, XP and coins in the corner", () => {
    game = mine({});
    render();
    expect(host.textContent).toContain("Alex Rivera");
    expect(host.textContent).toContain("Level 9");
    expect(host.textContent).toContain("Gardener");
    expect(host.querySelector("[data-hud-coins]")?.textContent).toContain("84");
  });

  test("shows just your name while the game is hidden", () => {
    game = mine({ hidden: true });
    render();
    expect(host.textContent).toContain("Alex Rivera");
    expect(host.textContent).not.toContain("Level");
    expect(host.querySelector("[data-hud-coins]")).toBeNull();
  });

  test("says where you are", () => {
    game = mine({});
    render();
    expect(host.textContent).toContain("You're at: Your garden");
  });

  test("the Places list is the navigation: every place, badges spoken, Enter walks there", () => {
    game = mine({});
    render();
    const nav = host.querySelector("nav[aria-label='Places']")!;
    const toggle = nav.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Quest signpost"), expect.stringContaining("The store stall")]));
    // Focus lands on the first place, so the list is usable from the keyboard at once.
    expect(document.activeElement).toBe(links[0]);
    const gatehouse = links.find((a) => a.textContent?.includes("The gatehouse"))!;
    expect(gatehouse.getAttribute("href")).toBe("/admin?tab=store");
    expect(gatehouse.textContent).toContain("2 open store requests");
    const stall = links.find((a) => a.textContent?.includes("The store stall"))!;
    act(() => stall.click());
    expect(url).toBe("/store");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("Escape closes the Places list and puts focus back on its button", () => {
    game = mine({});
    render();
    const toggle = host.querySelector<HTMLButtonElement>("nav[aria-label='Places'] button[aria-expanded]")!;
    act(() => toggle.click());
    act(() => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  test("tabbing out of the Places list closes it", () => {
    game = mine({});
    render();
    const toggle = host.querySelector<HTMLButtonElement>("nav[aria-label='Places'] button[aria-expanded]")!;
    act(() => toggle.click());
    const settings = host.querySelector<HTMLButtonElement>("button[aria-label='Settings']")!;
    act(() => settings.focus());
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("the settings menu signs out, switches off the game in the cabin and credits the hedgehog", () => {
    game = mine({});
    render();
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Settings']")!.click());
    expect(host.textContent).toContain("Sign out");
    expect(host.querySelector("a[href='/me']")?.textContent).toContain("Hide the game");
    expect(host.textContent).toContain("Hedgehog Mode by PostHog (MIT)");
  });
});
