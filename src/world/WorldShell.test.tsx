// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { parchmentTextOnDusk } from "@/testing/layout";

let queries: Record<string, unknown> = {};
/** The queries asked for (not skipped), in order. */
let asked: string[] = [];
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  // A query set to an Error fails the way Convex's `useQuery` does: it throws while rendering.
  const useQuery = (fn: never, args: unknown) => {
    if (args !== "skip") asked.push(getFunctionName(fn));
    const result = args === "skip" ? undefined : queries[getFunctionName(fn)];
    if (result instanceof Error) throw result;
    return result;
  };
  return { useQuery, useMutation: () => vi.fn() };
});
let reduced = false;
vi.mock("motion/react", async (real) => ({ ...(await real<typeof import("motion/react")>()), useReducedMotion: () => reduced, useReducedMotionConfig: () => reduced }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }) }));
// The Super kudos celebration: a modal of its own, while one waits.
let celebrating = false;
vi.mock("@/components/cosmetics", () => ({
  SuperKudosCelebration: () => (celebrating ? <div role="dialog" aria-modal="true" aria-label="A Super kudos" /> : null),
}));
// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { WorldShell } = await import("./WorldShell");
const { useQuery } = await import("convex/react");
const { api } = await import("../../convex/_generated/api");
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
/** A teammate's garden page, reading their garden as the real one does. */
function TheirGarden() {
  useQuery(api.gardens.of, { memberId: "m9" });
  return page("Their garden");
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
  asked = [];
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

function open(path: string, as: ReadyViewer = viewer) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={as}>
          <Routes>
            <Route element={<WorldShell />}>
              <Route index element={null} />
              <Route
                path="/me"
                element={page(
                  "Me",
                  <>
                    <Link to="/quests">This week's quests</Link>
                    <Link to="/garden/m9">Zoe's garden</Link>
                  </>,
                )}
              />
              <Route path="/quests" element={page("Quests")} />
              <Route path="/store" element={page("Store")} />
              <Route path="/garden" element={page("Garden")} />
              <Route path="/garden/:memberId" element={<TheirGarden />} />
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

describe("beside an open window (#171)", () => {
  /** A place's sign at a spot on the screen (happy-dom lays nothing out). */
  const signAt = (id: string, box: { left: number; top: number; width: number; height: number }) => {
    const sign = host.querySelector<HTMLElement>(`[data-sign=${id}]`)!;
    sign.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }) as DOMRect;
  };
  /** A click on the dimmed world round the window: it lands on the dialog's backdrop. */
  const clickBeside = (x: number, y: number) =>
    act(() => {
      const dialog = openWindow()!;
      dialog.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }));
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    });

  test("one click on a place's sign closes the window and walks there: a sign is a door", () => {
    open("/quests");
    signAt("store", { left: 100, top: 200, width: 120, height: 20 });
    clickBeside(150, 210);
    expect(url).toBe("/store");
    expect(openWindow()).toBeNull();
    walkFor(4000);
    expect(windowTitle()).toBe("The store stall");
    expect(caption()).toBe("The store stall");
  });

  test("a click beside the window that isn't on a sign just closes it, the hedgehog staying put", () => {
    open("/quests");
    signAt("store", { left: 100, top: 200, width: 120, height: 20 });
    clickBeside(400, 500);
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
    walkFor(4000);
    expect(caption()).toBe("Quest signpost");
  });

  test("from a teammate's garden, the sign of your own garden walks you there (review)", () => {
    open("/garden/m9");
    signAt("garden", { left: 100, top: 200, width: 120, height: 20 });
    clickBeside(150, 210);
    expect(url).toBe("/garden");
  });

  test("the open place's own sign closes its window", () => {
    open("/quests");
    signAt("quests", { left: 100, top: 200, width: 120, height: 20 });
    clickBeside(150, 210);
    expect(url).toBe("/");
    expect(openWindow()).toBeNull();
  });

  test("the caption's notes wrap in the width left of the docked window, and get the width back when it closes", () => {
    // happy-dom's screen is 1024 px wide: the window docks at half of it plus its frame's room.
    open("/quests");
    const captionBox = () => host.querySelector<HTMLElement>("[data-hud-caption]")!;
    expect(captionBox().style.right).toBe("536px");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(captionBox().style.right).toBe("");
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

  test("after a window closes, focus is back on Places and every arrow key still walks (#148 review)", () => {
    open("/me");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    const places = host.querySelector<HTMLButtonElement>("nav[aria-label='Places'] button")!;
    expect(document.activeElement).toBe(places);
    for (const key of ["ArrowDown", "ArrowDown"]) {
      act(() => {
        document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        document.activeElement!.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      });
      walkFor(400);
    }
    expect(places.getAttribute("aria-expanded")).toBe("false");
    expect(caption()).not.toBe("Your cabin");
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

  test("a teammate who gave a thoughtful kudos today has a sprout on their bed, and their bubble says so (#134)", () => {
    queries = { "gardens:neighbours": ring, "life:sprouts": ["m7"] };
    open("/garden/m7");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(host.querySelector("[data-neighbour-bubble]")!.textContent).toContain("Gave a thoughtful kudos today");
    // Text on the parchment bubble is ink (#126).
    const line = [...host.querySelectorAll("[data-neighbour-bubble] p")].find((p) => p.textContent?.includes("thoughtful"))!;
    expect([...line.classList].filter((c) => /^text-(?!xs|sm|base)/.test(c))).toEqual(["text-ink"]);
  });

  test("on other days, no such line", () => {
    queries = { "gardens:neighbours": ring, "life:sprouts": [] };
    open("/garden/m7");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(host.querySelector("[data-neighbour-bubble]")!.textContent).not.toContain("thoughtful");
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

test("a teammate's garden is asked for while the hedgehog walks there, so its window opens with their name (#148 review)", () => {
  queries = { "gardens:of": { name: "Zoe", avatarUrl: null, plants: [] } };
  open("/me");
  asked = [];
  act(() => openWindow()!.querySelector<HTMLAnchorElement>("a[href='/garden/m9']")!.click());
  expect(openWindow()).toBeNull(); // on the way
  expect(asked).toContain("gardens:of");
});

test("a garden link that fails leaves the world standing: the map, the HUD and a window saying so (#148)", () => {
  const quiet = vi.spyOn(console, "error").mockImplementation(() => {}); // React reports the caught error
  queries = { "gardens:of": new Error("[CONVEX Q(gardens:of)] ArgumentValidationError: Value does not match validator.") };
  open("/garden/doesnotexist");
  expect(host.querySelector("canvas[data-world]")).not.toBeNull();
  expect(host.querySelector("nav[aria-label='Places']")).not.toBeNull();
  expect(windowTitle()).toBe("A teammate's garden");
  expect(openWindow()!.textContent).toContain("Something went wrong");
  quiet.mockRestore();
});

describe("life in the world (#134)", () => {
  const player = (level: number, title: string) => ({ level, title, xp: 1650, floor: 1500, next: 1900, toNext: 250, fraction: 0.4 });
  const wallet = (balance: number) => ({ balance, fromKudos: balance, fromFruit: 0, fromQuests: 0, fromSprees: 0, fromLevels: 0, spent: 0, adjusted: 0 });
  const game = (level: number, title: string, coins = 84) => ({ enabled: true, hidden: false, player: player(level, title), wallet: wallet(coins), luckyCharms: 0, sunlamps: 0, lanterns: 0 });
  const counts = (discovered: number) => ({ used: 0, remaining: 5, limit: 5, discovered, total: 72 });
  const hog = () => host.querySelector<HTMLCanvasElement>("canvas[data-hog]")!;
  const toast = () => document.querySelector("[aria-live='polite'] [data-toast]");

  test("arriving at the notice board after a walk, the hedgehog reads it", () => {
    open("/me");
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    act(() => host.querySelector<HTMLElement>("[data-sign=leaderboard]")!.click());
    walkFor(4000);
    expect(windowTitle()).toBe("Notice board");
    expect(hog().dataset.animation).toBe("sign");
  });

  test("a level-up while the app is open: the hedgehog jumps and a toast says what it brought", () => {
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(20) };
    open("/");
    expect(toast()).toBeNull();
    queries = { "game:mine": game(10, "Grove keeper"), "me:today": counts(20) };
    open("/");
    expect(toast()?.textContent).toContain("Level 10, Grove keeper, +1 skill point");
    expect(hog().dataset.animation).toBe("jump");
  });

  test("under reduced motion the level-up still toasts, and the hedgehog keeps its still frame", () => {
    reduced = true;
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(20) };
    open("/");
    queries = { "game:mine": game(10, "Grove keeper"), "me:today": counts(20) };
    open("/");
    expect(toast()?.textContent).toContain("Level 10");
    expect(hog().dataset.animation).toBe("idle");
  });

  test("coins earned hop into the counter, once; not under reduced motion", () => {
    queries = { "game:mine": game(9, "Gardener", 84), "me:today": counts(20) };
    open("/garden");
    queries = { "game:mine": game(9, "Gardener", 87), "me:today": counts(20) };
    open("/garden");
    expect(document.querySelectorAll("[data-coin-hop] [data-coin]").length).toBe(3);
    walkFor(2000);
    expect(document.querySelector("[data-coin-hop]")).toBeNull();
    reduced = true;
    queries = { "game:mine": game(9, "Gardener", 90), "me:today": counts(20) };
    open("/garden");
    expect(document.querySelector("[data-coin-hop]")).toBeNull();
  });

  test("picked fruit hops from the garden's Pick button, so the hedgehog doesn't hop it again", () => {
    queries = { "game:mine": game(9, "Gardener", 84), "me:today": counts(20) };
    open("/garden");
    const picked = game(9, "Gardener", 90);
    queries = { "game:mine": { ...picked, wallet: { ...picked.wallet, fromKudos: 84, fromFruit: 6 } }, "me:today": counts(20) };
    open("/garden");
    expect(document.querySelector("[data-coin-hop]")).toBeNull();
  });

  test("switching workspace is nothing that happened to you: no level-up, no coins", () => {
    queries = { "game:mine": game(9, "Gardener", 84), "me:today": counts(20) };
    open("/");
    const elsewhere = { ...viewer, member: { ...viewer.member, _id: "m9" } } as ReadyViewer;
    queries = { "game:mine": game(12, "Elder", 400), "me:today": counts(40) };
    open("/", elsewhere);
    expect(toast()).toBeNull();
    expect(document.querySelector("[data-coin-hop]")).toBeNull();
    expect(hog().dataset.animation).toBe("idle");
  });

  test("hiding the game and showing it again later is no flood of what happened meanwhile", () => {
    queries = { "game:mine": game(9, "Gardener", 84), "me:today": counts(20) };
    open("/");
    queries = { "game:mine": { ...game(9, "Gardener", 84), hidden: true } };
    open("/");
    queries = { "game:mine": game(11, "Grove keeper", 120), "me:today": counts(25) };
    open("/");
    expect(toast()).toBeNull();
    expect(document.querySelector("[data-coin-hop]")).toBeNull();
  });

  test("a toast carries on where it was when the window closes: not shown again, its clock not restarted", () => {
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(20) };
    open("/garden");
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(21) };
    open("/garden");
    const shown = toast();
    expect(openWindow()!.contains(shown)).toBe(true);
    walkFor(5000);
    act(() => openWindow()!.querySelector<HTMLButtonElement>("[data-close]")!.click());
    expect(openWindow()).toBeNull();
    expect(toast()).toBe(shown);
    walkFor(3500);
    expect(toast()).toBeNull();
  });

  test("the toast shows over an open window, where you can still read and dismiss it", () => {
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(20) };
    open("/garden");
    queries = { "game:mine": game(9, "Gardener"), "me:today": counts(21) };
    open("/garden");
    expect(openWindow()!.querySelector("[aria-live='polite'] [data-toast='discovery']")?.textContent).toContain("New message discovered");
  });

  test("a bonus day turns the sky to golden hour and puts the hedgehog in its party hat", () => {
    queries = { "game:mine": game(9, "Gardener"), "boosts:banner": { current: { kind: "double", text: "Bonus day: double XP" }, upcoming: [] } };
    open("/");
    expect(host.querySelector("[data-sky]")?.getAttribute("data-sky")).toBe("golden");
    expect(hog().dataset.accessory).toBe("party");
  });

  test("an ordinary day is dusk, bare-headed", () => {
    queries = { "game:mine": game(9, "Gardener"), "boosts:banner": { current: null, upcoming: [] } };
    open("/");
    expect(host.querySelector("[data-sky]")?.getAttribute("data-sky")).toBe("dusk");
    expect(hog().dataset.accessory).toBeUndefined();
  });
});
