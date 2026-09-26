// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { HomeRingContext } from "@/world/homeRing";

/**
 * Homes on the tree (#160): your home's window at the homes district (buy a plot on the mini ring or
 * the next free one, build the next stage with its cost, discount and days left, the guestbook), a
 * teammate's home (owner, stage, guestbook, "Leave a lantern"), and the canopy at night.
 */

let queries: Record<string, unknown> = {};
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "homes:buy": vi.fn(async () => null),
  "homes:build": vi.fn(async () => null),
  "homes:leaveLantern": vi.fn(async () => null),
  "homes:takeDownLantern": vi.fn(async () => null),
};
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args: unknown) => (args === "skip" ? undefined : queries[getFunctionName(fn)]),
  useMutation: (fn: FunctionReference<"mutation">) => mutations[getFunctionName(fn)],
}));

const { Homes, HomeOf, Canopy } = await import("./Homes");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  queries = {};
  for (const m of Object.values(mutations)) m.mockClear();
});

const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
const plots = [{ x: 26, y: 2 }, { x: -21, y: 16 }, null, { x: 14, y: 22 }, { x: -25, y: -7 }];

function render(path: string) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={viewer}>
          <HomeRingContext.Provider value={{ plots, seed: 7 }}>
            <div data-window-body className="@container pixel-frame">
              <Routes>
                <Route path="/homes" element={<Homes />} />
                <Route path="/homes/:memberId" element={<HomeOf />} />
                <Route path="/canopy" element={<Canopy />} />
              </Routes>
            </div>
          </HomeRingContext.Provider>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const text = () => document.body.textContent ?? "";
const button = (name: string | RegExp) => [...document.querySelectorAll("button")].find((b) => (typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? "")));
const click = async (el: Element | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
};

const mine = (patch: Record<string, unknown> = {}) => ({ open: true, plots: 5, price: 40, level: 9, buyLevel: 3, balance: 120, discount: null, home: null, ...patch });
const ring = [
  { plot: 0, memberId: "m_lena", name: "Lena Hoffmann", stage: "canopy_manor", building: false },
  { plot: 3, memberId: "m_priya", name: "Priya Raman", stage: "leaf_hut", building: true },
];

describe("your home's window", () => {
  test("without a home: buy the next free plot, or pick one on the ring", async () => {
    queries = { "homes:mine": mine(), "homes:all": ring };
    render("/homes");
    expect(text()).toContain("A plot costs 40 Hog coins");
    // Plot 0 and 3 are taken, 2 is where a district stands: 1 is the next free one.
    await click(button(/Buy the next free plot/));
    expect(mutations["homes:buy"]).toHaveBeenCalledWith({ plot: 1 });
    const picks = [...document.querySelectorAll("[data-plot-pick]")];
    expect(picks.map((p) => [p.getAttribute("data-plot-pick"), p.getAttribute("data-state")])).toEqual([
      ["0", "taken"],
      ["1", "free"],
      ["3", "taken"],
      ["4", "free"],
    ]);
    await click(picks[3]);
    await click(button(/Buy plot 5/));
    expect(mutations["homes:buy"]).toHaveBeenLastCalledWith({ plot: 4 });
  });

  test("short of coins: the buttons wait, and say how many more", () => {
    queries = { "homes:mine": mine({ balance: 25 }), "homes:all": ring };
    render("/homes");
    expect(button(/Buy the next free plot/)?.disabled).toBe(true);
    expect(text()).toContain("15 more Hog coins and a plot is yours");
  });

  test("the ring not open yet, or the wallet not yet: says when", () => {
    queries = { "homes:mine": mine({ open: false, plots: 0 }), "homes:all": [] };
    render("/homes");
    expect(text()).toContain("The homes ring opens when the tree is a grown tree");
    act(() => root?.unmount());
    document.body.innerHTML = "";
    queries = { "homes:mine": mine({ level: 2, balance: null }), "homes:all": [] };
    render("/homes");
    expect(document.querySelector("[data-locked]")).toBeTruthy();
    expect(button(/Buy/)).toBeUndefined();
  });

  test("with a home: its stage, the next stage's cost with the star fruit, and building it", async () => {
    queries = {
      "homes:mine": mine({ discount: 25, home: { plot: 1, stage: "planks", building: null, next: { id: "leaf_hut", name: "Leaf hut", cost: 60, discounted: 45, days: 5 }, guestbook: [] } }),
      "homes:all": ring,
    };
    render("/homes");
    expect(text()).toContain("Scarves and planks");
    expect(text()).toContain("Plot 2 on the homes ring");
    expect(text()).toContain("45 Hog coins with your star fruit (60)");
    expect(text()).toContain("5 days");
    await click(button(/Build the leaf hut/));
    expect(mutations["homes:build"]).toHaveBeenCalledWith({});
  });

  test("building: days left; the guestbook with moderation", async () => {
    queries = {
      "homes:mine": mine({
        home: {
          plot: 1,
          stage: "planks",
          building: { to: "leaf_hut", name: "Leaf hut", doneAt: 0, daysLeft: 3 },
          next: null,
          guestbook: [{ _id: "l1", by: "Priya Raman", note: "Thanks for the tea", at: Date.UTC(2026, 8, 20), canTakeDown: true }],
        },
      }),
      "homes:all": ring,
    };
    render("/homes");
    expect(text()).toContain("Building the leaf hut: 3 days left");
    expect(button(/Build/)).toBeUndefined();
    expect(text()).toContain("Priya Raman");
    expect(text()).toContain("Thanks for the tea");
    await click(button("Take down"));
    expect(mutations["homes:takeDownLantern"]).toHaveBeenCalledWith({ lanternId: "l1" });
  });

  test("the neighbours' homes to visit", () => {
    queries = { "homes:mine": mine(), "homes:all": ring };
    render("/homes");
    const links = [...document.querySelectorAll("a[href^='/homes/']")].map((a) => [a.getAttribute("href"), a.textContent]);
    expect(links).toEqual([
      ["/homes/m_lena", expect.stringContaining("Lena Hoffmann")],
      ["/homes/m_priya", expect.stringContaining("Priya Raman")],
    ]);
  });
});

describe("visiting a home", () => {
  const visit = (patch: Record<string, unknown> = {}) => ({
    memberId: "m_lena",
    name: "Lena Hoffmann",
    avatarUrl: null,
    look: { frame: "frame_gold" },
    plot: 0,
    stage: "canopy_manor",
    building: null,
    yours: false,
    canLeaveLantern: true,
    guestbook: [],
    ...patch,
  });

  test("owner (by their frame and banner), stage and guestbook; leave a lantern", async () => {
    queries = { "homes:of": visit() };
    render("/homes/m_lena");
    expect(document.querySelector("[data-owner]")?.textContent).toContain("Lena Hoffmann");
    expect(text()).toContain("Canopy manor");
    expect(text()).toContain("No lanterns yet");
    const input = document.querySelector<HTMLInputElement>("input[name='note']")!;
    expect(input.maxLength).toBe(80);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(input, "Thanks for hosting");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button("Leave a lantern"));
    expect(mutations["homes:leaveLantern"]).toHaveBeenCalledWith({ memberId: "m_lena", note: "Thanks for hosting" });
  });

  test("one lantern a week", () => {
    queries = { "homes:of": visit({ canLeaveLantern: false }) };
    render("/homes/m_lena");
    expect(button("Leave a lantern")).toBeUndefined();
    expect(text()).toContain("You left a lantern here this week");
  });

  test("nobody's home", () => {
    queries = { "homes:of": null };
    render("/homes/m_nobody");
    expect(text()).toContain("No home here");
  });
});

describe("the canopy", () => {
  test("every home on the ring, lit at night", () => {
    queries = { "homes:all": ring };
    render("/canopy");
    expect(document.querySelector("svg[aria-label^='The tree from above']")).toBeTruthy();
    expect(text()).toContain("2 homes lit");
  });
});
