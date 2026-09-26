// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Beat } from "./presence";

/** What the heartbeat mutation answers next. */
let answer: "ok" | "notShown" | "resetting" = "ok";
const heartbeat = vi.fn(async (_: Beat) => answer);
/** What each query answers, by name; the arguments each was last asked with. */
let queries: Record<string, unknown> = {};
let askedWith: Record<string, unknown> = {};
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: () => heartbeat,
    useQuery: (fn: never, args: unknown) => {
      if (args === "skip") return undefined;
      askedWith[getFunctionName(fn)] = args;
      return queries[getFunctionName(fn)];
    },
  };
});
// No atlas in tests: the hedgehogs keep their placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { useHeartbeat, Presence } = await import("./Presence");
const { buildWorld } = await import("./world");
const { layout } = await import("../../convex/lib/tree");
const { PLACES } = await import("./places");
const { MemoryRouter } = await import("react-router");
HTMLCanvasElement.prototype.getContext = (() => null) as never;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
let hidden = false;
beforeEach(() => {
  queries = {};
  askedWith = {};
  answer = "ok";
  hidden = false;
  heartbeat.mockClear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame"] });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

/** Your hog: standing at (4, 4) until a test moves it. */
let me: Beat = { x: 4, y: 4, facing: "right", animation: "idle" };
function Beating({ on }: { on: boolean }) {
  useHeartbeat({ on, read: () => me });
  return null;
}
const mount = (on = true) => act(() => root.render(<Beating on={on} />));
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const setHidden = (value: boolean) =>
  act(() => {
    hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
  });

describe("your hog's heartbeat", () => {
  beforeEach(() => {
    me = { x: 4, y: 4, facing: "right", animation: "idle" };
  });

  test("standing still: one beat as you arrive, then one every 20 s", async () => {
    mount();
    await wait(300);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(heartbeat).toHaveBeenLastCalledWith({ x: 4, y: 4, facing: "right", animation: "idle" });
    await wait(19_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    await wait(1_500);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  test("walking: at most 4 beats a second, however fast you go", async () => {
    mount();
    await wait(300);
    heartbeat.mockClear();
    const walk = setInterval(() => (me = { ...me, x: me.x + 1, animation: "walk" }), 50);
    await wait(2_000);
    clearInterval(walk);
    expect(heartbeat.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(heartbeat.mock.calls.length).toBeLessThanOrEqual(8);
  });

  test("in a hidden tab, no beats; back in view, one at once", async () => {
    mount();
    await wait(300);
    heartbeat.mockClear();
    setHidden(true);
    me = { ...me, x: 9 };
    await wait(60_000);
    expect(heartbeat).not.toHaveBeenCalled();
    setHidden(false);
    await wait(300);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(heartbeat).toHaveBeenLastCalledWith(expect.objectContaining({ x: 9 }));
  });

  test("while the game is hidden, never", async () => {
    mount(false);
    await wait(60_000);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  test("told the game isn't shown to you, it stops until the game is shown again", async () => {
    answer = "notShown";
    mount();
    await wait(300);
    me = { ...me, x: 9, animation: "walk" };
    await wait(60_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    answer = "ok";
    mount(false);
    mount(true);
    await wait(300);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  test("while the demo resets, only the idle pace", async () => {
    answer = "resetting";
    mount();
    await wait(300);
    const walk = setInterval(() => (me = { ...me, x: me.x + 1, animation: "walk" }), 50);
    await wait(10_000);
    clearInterval(walk);
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });
});

const world = buildWorld({ seed: 1, layout: layout(1, 20_000), planted: true, standing: PLACES.map((p) => p.id) });
const hog = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  memberId: "m2",
  name: "Ana Lima",
  title: "Gardener",
  x: 6,
  y: 6,
  facing: "right",
  animation: "idle",
  look: { color: null, accessory: null },
  hasHome: false,
  updatedAt: 0,
  ...patch,
});
const viewer = { memberId: "m1", workspaceName: "Lumen Labs", sharedDemo: false };
const team = [
  { memberId: "m7", name: "Lena Hoffmann" },
  { memberId: "m8", name: "Sam Ortiz" },
];
function layer(patch: Partial<Parameters<typeof Presence>[0]> = {}) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <Presence
          on
          world={world}
          scale={3}
          still={false}
          viewer={viewer}
          read={() => ({ x: 4, y: 4, facing: "right", animation: "idle" })}
          wanderers={team}
          today="2026-09-26"
          party={false}
          windowOpen={false}
          {...patch}
        />
      </MemoryRouter>,
    ),
  );
}
const hogs = () => [...host.querySelectorAll<HTMLElement>("[data-other-hog]")];
const card = () => host.querySelector<HTMLElement>("[data-hog-card]");

describe("the other hogs round you", () => {
  test("each hog online nearby stands where it is, wearing its look, with its name on a tag", () => {
    queries["presence:nearby"] = [hog("p1", { look: { color: "blue", accessory: "tophat" } }), hog("p2", { name: "Ben Okafor", memberId: "m3", x: 9 })];
    layer();
    expect(hogs().map((h) => h.dataset.otherHog)).toEqual(["p1", "p2"]);
    expect(hogs()[0].querySelector("[data-name-tag]")?.textContent).toBe("Ana Lima");
    expect(hogs()[1].querySelector("[data-name-tag]")?.textContent).toBe("Ben Okafor");
    expect(hogs()[0].querySelector<HTMLCanvasElement>("canvas[data-hog]")?.dataset.color).toBe("blue");
    expect(hogs()[0].querySelector("canvas[data-hog-accessory]")?.getAttribute("data-accessory")).toBe("tophat");
  });

  test("two visitors who are the same member are two hogs", () => {
    queries["presence:nearby"] = [hog("p1", { memberId: "m1", name: "Alex Rivera" }), hog("p2", { memberId: "m1", name: "Alex Rivera" })];
    layer();
    expect(hogs()).toHaveLength(2);
  });

  test("asks for the chunks round you, on the workspace clock rounded to 5 s", () => {
    vi.setSystemTime(1_000_004_321);
    layer();
    expect(askedWith["presence:nearby"]).toEqual({ chunks: ["-1:-1", "0:-1", "1:-1", "-1:0", "0:0", "1:0", "-1:1", "0:1", "1:1"], now: 1_000_000_000 });
  });

  test("on a bonus day everyone wears the party hat", () => {
    queries["presence:nearby"] = [hog("p1", { look: { color: "red", accessory: "cap" } })];
    layer({ party: true });
    expect(hogs()[0].querySelector("canvas[data-hog-accessory]")?.getAttribute("data-accessory")).toBe("party");
  });

  test("the one lower on the screen stands in front", async () => {
    queries["presence:nearby"] = [hog("p1", { x: 20, y: 20 }), hog("p2", { x: 2, y: 2 })];
    layer();
    await wait(50);
    const [near, far] = hogs();
    expect(Number(near.style.zIndex)).toBeGreaterThan(Number(far.style.zIndex));
  });

  test("walking, it glides to where it was seen next and walks as it goes", async () => {
    queries["presence:nearby"] = [hog("p1", { x: 6, y: 6 })];
    layer();
    await wait(50);
    const before = hogs()[0].style.transform;
    queries["presence:nearby"] = [hog("p1", { x: 8, y: 6, animation: "walk" })];
    layer();
    await wait(100);
    const midway = hogs()[0].style.transform;
    await wait(1000);
    const after = hogs()[0].style.transform;
    expect(new Set([before, midway, after]).size).toBe(3);
  });

  test("nobody, while the game is hidden", () => {
    queries["presence:nearby"] = [hog("p1")];
    layer({ on: false });
    expect(hogs()).toEqual([]);
    expect(askedWith["presence:nearby"]).toBeUndefined();
  });
});

describe("a hog's card", () => {
  test("clicking a hog opens its card: name, level title, and the way to their garden", () => {
    queries["presence:nearby"] = [hog("p1")];
    layer();
    act(() => hogs()[0].querySelector<HTMLElement>("[data-hog-hit]")!.click());
    expect(card()?.querySelector("h2")?.textContent).toBe("Ana Lima");
    expect(card()?.textContent).toContain("Gardener");
    const visit = [...card()!.querySelectorAll("a")].find((a) => a.textContent === "Visit their garden")!;
    expect(visit.getAttribute("href")).toBe("/garden/m2");
    expect(card()?.textContent).not.toContain("Invite to party");
    expect(card()?.textContent).not.toContain("Visit their home");
  });

  test("Escape closes it; so does the hog leaving", () => {
    queries["presence:nearby"] = [hog("p1")];
    layer();
    act(() => hogs()[0].querySelector<HTMLElement>("[data-hog-hit]")!.click());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(card()).toBeNull();
    act(() => hogs()[0].querySelector<HTMLElement>("[data-hog-hit]")!.click());
    queries["presence:nearby"] = [];
    layer();
    expect(card()).toBeNull();
  });

  test("hidden while a window is open", () => {
    queries["presence:nearby"] = [hog("p1")];
    layer();
    act(() => hogs()[0].querySelector<HTMLElement>("[data-hog-hit]")!.click());
    layer({ windowOpen: true });
    expect(card()).toBeNull();
  });
});

describe("the demo's wandering teammates", () => {
  test("in the shared demo, teammates stroll the districts, and say so on their card", () => {
    queries["cosmetics:profile"] = { name: "Lena Hoffmann", avatarUrl: null, level: 12, title: "Herald", given: 10, look: {} };
    layer({ viewer: { ...viewer, sharedDemo: true } });
    const npcs = hogs().filter((h) => h.dataset.wanderer !== undefined);
    expect(npcs.map((h) => h.querySelector("[data-name-tag]")?.textContent)).toEqual(["Lena Hoffmann", "Sam Ortiz"]);
    act(() => npcs[0].querySelector<HTMLElement>("[data-hog-hit]")!.click());
    expect(card()?.textContent).toContain("Lumen Labs teammate");
    expect(card()?.textContent).toContain("Herald");
  });

  test("never in a real workspace", () => {
    layer();
    expect(hogs().filter((h) => h.dataset.wanderer !== undefined)).toEqual([]);
  });
});
