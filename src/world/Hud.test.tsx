// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { navItems } from "@/lib/nav";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { MOTION_KEY, MotionProvider } from "./motion";
import { visiblePlaces } from "./places";

let game: unknown;
/** Who is online (`presence:online`), and what it was last asked with. */
let online: unknown;
let onlineArgs: unknown;
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args: unknown) => {
    const name = getFunctionName(fn);
    if (name === "presence:online" && args !== "skip") onlineArgs = args;
    return name === "game:mine" ? game : name === "presence:online" && args !== "skip" ? online : undefined;
  },
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
const mine = (patch: Record<string, unknown>) => ({ enabled: true, hidden: false, player: player(9), wallet, luckyCharms: 0, sunlamps: 0, lanterns: 0, look: { color: null, accessory: null }, ...patch });

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

function render({ insetRight, whereIs }: { insetRight?: number; whereIs?: (spot: { x: number; y: number }) => string } = {}) {
  const places = visiblePlaces(navItems({ isAdmin: true, isDemo: false, storeEnabled: true, gameShown: true, openRequests: 2 }));
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <MotionProvider>
          <ViewerContext.Provider value={viewer}>
            <Hud places={places} where="Your garden" insetRight={insetRight} whereIs={whereIs} />
            <Probe />
          </ViewerContext.Provider>
        </MotionProvider>
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

  test("the XP meter keeps its small width, so the XP and coins fit inside the card (#148)", () => {
    // Two width utilities fight, and the stylesheet's order picks the winner: `w-full` stretched the
    // meter across the card and pushed "2,067 XP" and the coins out over the world.
    game = mine({});
    render();
    const meter = host.querySelector("[data-hud-you] [role='progressbar']")!;
    expect([...meter.classList].filter((c) => /^w-/.test(c))).toEqual(["w-24"]);
  });

  test("the level number is set in Nunito with tabular figures, the word in Pixelify: Pixelify's 5 reads as an S (#171)", () => {
    // Class names only (happy-dom has no stylesheet): the nearest font class round the number wins.
    game = mine({ player: player(25) });
    render();
    const numbers = [...host.querySelectorAll("[data-hud-you] *")].filter((el) => el.children.length === 0 && el.textContent === "25");
    // Both the wide card and the phone's one-liner.
    expect(numbers).toHaveLength(2);
    for (const n of numbers) {
      expect(n.closest(".font-display, .font-sans")?.classList).toContain("font-sans");
      expect(n.closest(".tabular")).not.toBeNull();
      expect(n.closest(".font-display, .font-sans")?.parentElement?.closest(".font-display")?.textContent).toMatch(/^Level/);
    }
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

  test("the Places button speaks its badge in its name, with no hidden text that can hang past the screen's edge (#171)", () => {
    game = mine({});
    render();
    const toggle = host.querySelector<HTMLButtonElement>("nav[aria-label='Places'] button[aria-expanded]")!;
    expect(toggle.getAttribute("aria-label")).toBe("Places (something waits for you)");
    expect(toggle.querySelector(".sr-only")).toBeNull();
  });

  test("with a window docked on the right the caption's notes wrap in the width left of it (#171)", () => {
    game = mine({});
    render({ insetRight: 664 });
    expect(host.querySelector<HTMLElement>("[data-hud-caption]")!.style.right).toBe("664px");
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(host.querySelector<HTMLElement>("[data-hud-caption]")!.style.right).toBe("");
  });

  test("the open Places list lies over the caption's notes and scrolls on a short screen, so every place can be tapped (#148)", () => {
    game = mine({});
    render();
    const nav = host.querySelector("nav[aria-label='Places']")!;
    act(() => nav.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    // Stacking by class names (happy-dom has no stylesheet): the z-index of the fixed HUD layer round each.
    const layer = (el: Element) => Number(/(?:^|\s)z-(\d+)/.exec(el.closest(".fixed")!.className)?.[1] ?? 0);
    const list = nav.querySelector("ul")!;
    const note = [...host.querySelectorAll("p")].find((p) => p.textContent?.startsWith("You're at"))!;
    expect(layer(list)).toBeGreaterThan(layer(note));
    const panel = list.closest("[data-hud-menu]")!;
    expect(panel.className).toMatch(/(^|\s)max-h-/);
    expect(panel.className).toMatch(/(^|\s)overflow-y-auto(\s|$)/);
  });

  test("the arrow keys move through the open Places list, round from the last to the first; Home and End jump (#148)", () => {
    game = mine({});
    render();
    const nav = host.querySelector("nav[aria-label='Places']")!;
    act(() => nav.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    const links = [...nav.querySelectorAll("a")];
    const key = (k: string) => {
      const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
      act(() => void document.activeElement!.dispatchEvent(e));
      return e;
    };
    expect(document.activeElement).toBe(links[0]);
    // Handled here, so the hedgehog doesn't walk as well.
    expect(key("ArrowDown").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(links[1]);
    key("ArrowUp");
    expect(document.activeElement).toBe(links[0]);
    key("ArrowUp");
    expect(document.activeElement).toBe(links.at(-1));
    key("ArrowDown");
    expect(document.activeElement).toBe(links[0]);
    key("End");
    expect(document.activeElement).toBe(links.at(-1));
    key("Home");
    expect(document.activeElement).toBe(links[0]);
  });

  test("on the closed Places button the arrow keys are left to the hedgehog (#148 review)", () => {
    game = mine({});
    render();
    const toggle = host.querySelector<HTMLButtonElement>("nav[aria-label='Places'] button[aria-expanded]")!;
    act(() => toggle.focus());
    const e = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    act(() => void toggle.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("the key hint is for keyboards: hidden on touch screens and on phone-sized screens (#148)", () => {
    // Class names only (happy-dom has no media queries). Headless phone emulation doesn't report a
    // coarse pointer, so the phone width hides it too: a 390 px screen is a phone.
    game = mine({});
    render();
    const hint = [...host.querySelectorAll("span")].find((s) => s.textContent?.startsWith("Walk with the arrow keys"))!;
    expect(hint.classList).toContain("pointer-coarse:hidden");
    expect(hint.classList).toContain("max-sm:hidden");
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
    expect(host.querySelector("a[href='/me#door']")?.textContent).toContain("Hide the game");
    expect(host.textContent).toContain("Hedgehog Mode by PostHog (MIT)");
  });

  test("the settings menu switches motion on or reduced, and remembers it in this browser", () => {
    localStorage.removeItem(MOTION_KEY);
    game = mine({});
    render();
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Settings']")!.click());
    // Two toggle buttons in a labelled group: each a plain Tab stop, pressed or not.
    const group = host.querySelector("[role='group'][aria-label='Motion']")!;
    const option = (name: string) => [...group.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((b) => b.textContent === name)!;
    expect(option("On").getAttribute("aria-pressed")).toBe("true");
    expect(option("Reduced").getAttribute("aria-pressed")).toBe("false");
    act(() => option("Reduced").click());
    expect(option("Reduced").getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(MOTION_KEY)).toBe("reduced");
    act(() => option("On").click());
    expect(localStorage.getItem(MOTION_KEY)).toBe("on");
  });
});

describe("who's online", () => {
  const whereIs = (spot: { x: number; y: number }) => (spot.x > 100 ? "The desert" : "Base camp");
  const players = [
    { memberId: "m1", name: "Alex Rivera", x: 4, y: 4, you: true },
    { memberId: "m2", name: "Ana Lima", x: 300, y: -300, you: false },
    { memberId: "m3", name: "Ben Okafor", x: 2, y: 3, you: false },
  ];
  const button = () => [...host.querySelectorAll("button")].find((b) => /online/.test(b.textContent ?? ""));
  beforeEach(() => {
    online = undefined;
    onlineArgs = undefined;
    game = mine({});
  });

  test("\"3 online\" opens the list: each name, and where they are", () => {
    online = { count: 3, players };
    render({ whereIs });
    expect(button()?.textContent).toBe("3 online");
    act(() => button()!.click());
    const rows = [...host.querySelectorAll("[data-online] li")].map((li) => li.textContent);
    // You're where your caption says, at once; the others where they were within the last 15 s.
    expect(rows).toEqual(["You, Your garden", "Ana Lima, The desert", "Ben Okafor, Base camp"]);
  });

  test("asks on the workspace clock, rounded to 5 s", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(1_000_004_321);
    online = { count: 1, players: players.slice(0, 1) };
    render({ whereIs });
    expect(onlineArgs).toEqual({ now: 1_000_000_000 });
    vi.useRealTimers();
  });

  test("it stays open while the next answer loads (review #2)", () => {
    online = { count: 3, players };
    render({ whereIs });
    act(() => button()!.click());
    online = undefined;
    render({ whereIs });
    expect(button()?.textContent).toBe("3 online");
    expect(host.querySelectorAll("[data-online] li")).toHaveLength(3);
  });

  test("not there outside the world, nor before anyone is in it", () => {
    online = { count: 3, players };
    render();
    expect(button()).toBeUndefined();
    online = { count: 0, players: [] };
    render({ whereIs });
    expect(button()).toBeUndefined();
  });
});
