// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, widensSideways } from "@/testing/layout";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The garden window (#95, #129): your garden and its plots, a plot window for each key bed on the
 * map (`/garden?plot=N`), planting, picking fruit, and the plants grown for you.
 */

let mine: unknown;
let forMe: unknown = [];
let of: unknown = null;
let neighbours: unknown = [];
const plant = vi.fn();
const pick = vi.fn();
const uproot = vi.fn();
const useSunlamp = vi.fn();
const hangLantern = vi.fn();
const takeDownLantern = vi.fn();
let game: unknown = { enabled: true, hidden: false };
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    const results: Record<string, unknown> = { "gardens:mine": mine, "gardens:forMe": forMe, "gardens:of": of, "gardens:neighbours": neighbours, "game:mine": game };
    return results[name];
  },
  useMutation: (fn: FunctionReference<"mutation">) => {
    const name = getFunctionName(fn);
    const garden: Record<string, unknown> = { "gardens:plant": plant, "gardens:pick": pick, "gardens:useSunlamp": useSunlamp, "gardens:hangLantern": hangLantern, "gardens:takeDownLantern": takeDownLantern };
    return garden[name] ?? uproot;
  },
}));

const { Garden, GardenOf } = await import("./Garden");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  plant.mockReset();
  pick.mockReset();
  uproot.mockReset();
  forMe = [];
  of = null;
  neighbours = [];
  game = { enabled: true, hidden: false };
  useSunlamp.mockReset();
  hangLantern.mockReset();
  takeDownLantern.mockReset();
});

function render(path = "/garden") {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={viewer}>
          {/* The page lives in its window (#128): a parchment face, and a size container. */}
          <div data-window-body className="@container pixel-frame">
            <Routes>
              <Route path="/garden" element={<Garden />} />
              <Route path="/garden/:memberId" element={<GardenOf />} />
            </Routes>
          </div>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  // A window page (#127, #131): no page sign, viewport breakpoint, sideways scroll, dots, arrows or emoji.
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const click = (el: Element) => act(() => (el as HTMLElement).click());
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name || b.getAttribute("aria-label") === name);
const text = () => document.body.textContent ?? "";

const empty = {
  open: true,
  plots: 1,
  cost: 10,
  balance: 28,
  plants: [],
  memories: [],
  candidates: [
    { memberId: "m_ben", name: "Ben", avatarUrl: null },
    { memberId: "m_cleo", name: "Cleo", avatarUrl: null },
  ],
  species: [],
  harvest: { weekCoins: 0, weekXp: 0, capCoins: 14, capXp: 21, hold: 3 },
};
const growing = (extra: object) => ({
  plantId: "p1",
  species: "helpful_oak",
  speciesName: "Helpful oak",
  stage: "sapling",
  stageName: "Sapling",
  waterings: 2,
  dormant: false,
  lastWatered: "2026-09-28",
  plantedDay: "2026-09-24",
  next: { name: "Young", waterings: 4, days: 21 },
  awakeDays: 12,
  forId: "m_ben",
  forName: "Ben",
  fruit: [],
  goldenLeaves: 0,
  plot: 0,
  ...extra,
});

test("an empty garden at level 3: one empty key bed, and its plot window plants for a teammate thanked this week", () => {
  mine = empty;
  const host = render();
  expect(host.querySelectorAll("[data-plot]")).toHaveLength(1);
  expect(text()).toContain("Empty plot");
  expect(host.querySelector("[data-plot] svg[data-bed=empty]")).not.toBeNull(); // bare soil, not a seed
  expect(host.querySelector('a[href="/garden?plot=0"]')?.textContent).toContain("Plant here");
  render("/garden?plot=0");
  expect(text()).toContain("A plant costs 10 Hog coins");
  expect(button("Pick a teammate")?.hasAttribute("disabled")).toBe(true);
  click(document.querySelector('[data-candidate="m_cleo"]')!);
  click(button("Plant for Cleo")!);
  expect(plant).toHaveBeenCalledWith({ teammateId: "m_cleo", plot: 0 });
});

test("planting in the plot you opened plants there, not in the first free one (review #1)", () => {
  mine = { ...empty, plots: 3, plants: [growing({})] };
  render("/garden?plot=2");
  click(document.querySelector('[data-candidate="m_cleo"]')!);
  click(button("Plant for Cleo")!);
  expect(plant).toHaveBeenCalledWith({ teammateId: "m_cleo", plot: 2 });
});

test("with every plot in use (more plants than plots after a reset), an empty bed says so and offers no planting (review #3)", () => {
  mine = { ...empty, plots: 1, plants: [growing({ plot: 1 })] };
  const host = render();
  expect(host.querySelector('a[href="/garden?plot=0"]')?.textContent).not.toContain("Plant here");
  render("/garden?plot=0");
  expect(text()).toContain("Your garden has no free plot. Uproot a plant to make room.");
  expect(document.querySelector("[data-candidate]")).toBeNull();
});

test("the neighbours are listed in the window too, each with a way to their garden (review #6)", () => {
  mine = empty;
  neighbours = [
    { memberId: "m_ana", name: "Ana", plants: 2, top: { species: "kind_maple", stage: "grown" } },
    { memberId: "m_dan", name: "Dan", plants: 1, top: { species: "helpful_oak", stage: "seed" } },
  ];
  const host = render();
  const list = host.querySelector("[data-neighbours]")!;
  expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Ana2 plantsVisit garden", "Dan1 plantVisit garden"]);
  expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/garden/m_ana", "/garden/m_dan"]);
});

test("with the plant picker, the plot window offers the species too", () => {
  mine = { ...empty, species: [{ id: "patient_pine", name: "Patient pine", rare: false }] };
  render("/garden?plot=0");
  click(document.querySelector('[data-candidate="m_ben"]')!);
  const select = document.querySelector<HTMLSelectElement>("select")!;
  act(() => {
    select.value = "patient_pine";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  click(button("Plant for Ben")!);
  expect(plant).toHaveBeenCalledWith({ teammateId: "m_ben", species: "patient_pine", plot: 0 });
});

test("without a thoughtful kudos this week there's nobody to plant for, and the plot says how to get there", () => {
  mine = { ...empty, candidates: [] };
  render("/garden?plot=0");
  expect(button("Pick a teammate")).toBeUndefined();
  expect(text()).toContain("Thank a teammate in Slack with a few words on why");
});

test("a plot that isn't yours shows the whole garden", () => {
  mine = empty;
  render("/garden?plot=4");
  expect(text()).toContain("Empty plot");
  expect(text()).not.toContain("A plant costs");
});

test("locked below level 3, with the plants grown for you still shown", () => {
  mine = { open: false, opensAt: 3 };
  forMe = [{ ...growing({}), ownerId: "m_ana", ownerName: "Ana", ownerAvatarUrl: null }];
  const host = render();
  expect(host.querySelector('[data-locked][aria-label="Your garden, opens at level 3"]')).not.toBeNull();
  expect(text()).toContain("Ana is growing a Helpful oak for you");
  expect(host.querySelector('a[href="/garden/m_ana"]')).not.toBeNull();
});

test("your plots list each plant, whom it's for and its stage; each opens its plot window", () => {
  mine = { ...empty, plots: 2, plants: [growing({}), growing({ plantId: "p2", plot: 1, forName: "Cleo", dormant: true, stage: "young", stageName: "Young" })] };
  const host = render();
  const [first, second] = [...host.querySelectorAll("[data-plant]")];
  expect(first.textContent).toContain("Helpful oak");
  expect(first.textContent).toContain("for Ben");
  expect(first.textContent).toContain("Sapling");
  expect(first.querySelector("a")?.getAttribute("href")).toBe("/garden?plot=0");
  expect(second.getAttribute("data-dormant")).toBe("true");
  expect(second.textContent).toContain("Dormant");
  expect(second.querySelector("a")?.getAttribute("href")).toBe("/garden?plot=1");
});

test("a plant keeps its plot: the one before it uprooted, that plot is empty and the plant stays in its own", () => {
  mine = { ...empty, plots: 2, plants: [growing({ plot: 1 })] };
  const host = render();
  const [first, second] = [...host.querySelectorAll("[data-plot]")];
  expect(first.textContent).toContain("Empty plot");
  expect(second.getAttribute("data-plant")).toBe("p1");
  expect(second.querySelector("a")?.getAttribute("href")).toBe("/garden?plot=1");
  render("/garden?plot=1");
  expect(text()).toContain("for Ben");
  render("/garden?plot=0");
  expect(text()).toContain("A plant costs 10 Hog coins");
});

test("a plot window: the plant, whom it's for, what the next stage needs; a dormant one says how to wake it", () => {
  mine = { ...empty, plots: 2, plants: [growing({}), growing({ plantId: "p2", plot: 1, forName: "Cleo", dormant: true, stage: "young", stageName: "Young" })] };
  render("/garden?plot=0");
  expect(text()).toContain("Helpful oak");
  expect(text()).toContain("for Ben");
  expect(text()).toContain("2 of 4 waterings, 12 of 21 days to Young");
  expect(document.querySelector("svg[data-stage='sapling']")).not.toBeNull();
  expect(document.querySelector('a[href="/garden"]')?.textContent).toContain("All of your garden");
  render("/garden?plot=1");
  expect(text()).toContain("Dormant: thank Cleo with a few words on why to wake it");
});

test("golden leaves from Super kudos show on your plant for them, and on the plant grown for you (#98)", () => {
  mine = { ...empty, plants: [growing({ goldenLeaves: 2 })] };
  forMe = [{ ...growing({}), ownerId: "m_ana", ownerName: "Ana", ownerAvatarUrl: null, goldenLeaves: 1 }];
  render("/garden?plot=0");
  expect(text()).toContain("2 golden leaves");
  render();
  expect(text()).toContain("1 golden leaf from Ana's Super kudos");
});

test("the garden in pixels: PostHog's Keyboard garden up top, our own key beds, memories on a shelf, the gardener by an empty plot (#101)", () => {
  mine = {
    ...empty,
    plots: 3,
    plants: [growing({ species: "patient_pine", stage: "grown", stageName: "Grown", goldenLeaves: 1 }), growing({ plantId: "p2", plot: 1, forName: "Cleo", dormant: true, stage: "young", stageName: "Young" })],
    memories: [{ plantId: "p0", species: "bright_sunflower", speciesName: "Bright sunflower", stageName: "Grown", forName: "Dan", memoryDay: "2026-09-01", reason: "uprooted" }],
  };
  const host = render();
  expect(host.querySelector("[data-art-slot='garden-scene'] img")?.getAttribute("src")).toContain("keyboard_garden_dark_opt_15e213413c.png");
  const [pine, dormant] = [...host.querySelectorAll("[data-plant]")].map((p) => p.querySelector("svg")!);
  expect(pine.getAttribute("data-species")).toBe("patient_pine");
  expect(pine.getAttribute("data-bed")).toBe("key");
  expect(pine.getAttribute("data-golden-leaves")).toBe("1");
  expect(dormant.getAttribute("data-dormant")).toBe("true");
  expect(host.querySelector("[data-memories] svg")?.getAttribute("data-species")).toBe("bright_sunflower");
  expect(host.querySelector("[data-memories]")?.textContent).toContain("Bright sunflower for Dan");
  render("/garden?plot=2");
  expect(document.querySelector("[data-art-slot='hoggie-empty-plot'] img")?.getAttribute("src")).toContain("/hoggies/png/gardener-2.png");
  // In the same pixel frame as every hoggie inside a window (#134).
  expect(document.querySelector("[data-npc] [data-art-slot='hoggie-empty-plot']")).not.toBeNull();
});

test("if the Keyboard garden can't load, the window stands as it was, with our own key beds (#101)", () => {
  mine = { ...empty, plants: [growing({})] };
  const host = render();
  act(() => void host.querySelector("[data-art-slot='garden-scene'] img")!.dispatchEvent(new Event("error")));
  expect(host.querySelector("[data-art-slot='garden-scene'] img")).toBeNull();
  expect(host.querySelector("[data-plant] svg[data-bed=key]")).not.toBeNull();
});

test("with the game off or hidden, or the garden still locked, the Keyboard garden stays out (review #6)", () => {
  mine = null;
  game = { enabled: false, hidden: false };
  expect(render().querySelector("[data-art-slot='garden-scene']")).toBeNull();
  mine = { open: false, opensAt: 3 };
  game = { enabled: true, hidden: false };
  expect(render().querySelector("[data-art-slot='garden-scene']")).toBeNull();
});

test("fruit waiting: the Pick button says how many, the week's caps show, and picking hops the fruit to your coins", async () => {
  mine = {
    ...empty,
    plants: [growing({ stage: "grown", stageName: "Grown", fruit: [{ day: "2026-11-08", coins: 2 }, { day: "2026-11-09", coins: 1 }] })],
    harvest: { ...empty.harvest, weekCoins: 5, weekXp: 6 },
  };
  pick.mockResolvedValue({ fruit: 2, coins: 3, xp: 6 });
  const picked = vi.fn();
  window.addEventListener("kudos:fruit-picked", picked);
  render();
  expect(text()).toContain("2 fruit waiting, worth 3 Hog coins");
  expect(text()).toContain("5 of 14 Hog coins and 6 of 21 XP");
  await act(async () => (button("Pick 2 fruit") as HTMLElement).click());
  expect(pick).toHaveBeenCalledWith({});
  expect(text()).toContain("Picked 2 fruit: +3 Hog coins, +6 XP.");
  expect(picked).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll("[data-fruit-hop]").length).toBe(2);
  window.removeEventListener("kudos:fruit-picked", picked);
});

test("uprooting from the plot window asks first; the plant stays with your memories", () => {
  mine = { ...empty, plants: [growing({})], memories: [{ plantId: "p0", species: "kind_maple", speciesName: "Kind maple", stageName: "Sprout", forName: "Dan", memoryDay: "2026-09-01", reason: "uprooted" }] };
  render();
  expect(text()).toContain("Kind maple for Dan");
  render("/garden?plot=0");
  click(button("Uproot")!);
  click(document.querySelector("dialog[open] [data-confirm]")!);
  expect(uproot).toHaveBeenCalledWith({ plantId: "p1" });
});

test("on a phone, neither the garden nor a plot window scrolls sideways", () => {
  mine = { ...empty, plots: 2, plants: [growing({ lantern: { note: "A very long lantern note that keeps going on and on and on", by: "Cleo" } })] };
  for (const path of ["/garden", "/garden?plot=0", "/garden?plot=1"]) {
    const host = render(path);
    expect(widensSideways(host).map(describeElement), path).toEqual([]);
    expect(escapesFromScrollers(host).map(describeElement), path).toEqual([]);
  }
});

test("a teammate's garden never says whom the plants are for, except yours", () => {
  of = {
    name: "Ana",
    avatarUrl: null,
    plants: [
      { ...growing({}), forId: undefined, forName: undefined, fruit: undefined, forYou: true },
      { ...growing({ plantId: "p2", speciesName: "Kind maple" }), forId: undefined, forName: undefined, fruit: undefined, forYou: false },
    ],
  };
  mine = empty;
  render("/garden/m_ana");
  expect(text()).toContain("Every plant here is for a teammate");
  expect(text()).toContain("Growing for you");
  expect(text()).not.toContain("Ben");
});

describe("the garden boosters (#97)", () => {
  test("a plant waiting on age takes a Sunlamp when you have one", () => {
    game = { enabled: true, hidden: false, sunlamps: 2, lanterns: 0 };
    mine = { ...empty, plots: 2, plants: [growing({ sunlamp: true, lantern: null }), growing({ plantId: "p2", plot: 1, forName: "Cleo", sunlamp: false, lantern: null })] };
    render("/garden?plot=0");
    click(button("Use a Sunlamp on Helpful oak for Ben (2 left)")!);
    expect(useSunlamp).toHaveBeenCalledWith({ plantId: "p1" });
    render("/garden?plot=1");
    expect(button("Use a Sunlamp on Helpful oak for Cleo (2 left)")).toBeUndefined();
  });

  test("without a Sunlamp there's no button", () => {
    game = { enabled: true, hidden: false, sunlamps: 0, lanterns: 0 };
    mine = { ...empty, plants: [growing({ sunlamp: true, lantern: null })] };
    render("/garden?plot=0");
    expect(text()).not.toContain("Sunlamp");
  });

  test("a lantern shows its note and who hung it, and the owner can take it down", () => {
    mine = { ...empty, plants: [growing({ sunlamp: false, lantern: { note: "Keep growing!", by: "Cleo" } })] };
    render("/garden?plot=0");
    expect(text()).toContain("Lantern from Cleo: “Keep growing!”");
    click(button("Take down Cleo's lantern")!);
    expect(takeDownLantern).toHaveBeenCalledWith({ plantId: "p1" });
  });

  test("no Lantern form on the plant grown for you: it would give away whose it is", () => {
    game = { enabled: true, hidden: false, sunlamps: 0, lanterns: 1 };
    of = { name: "Ana", avatarUrl: null, plants: [{ ...growing({}), forId: undefined, forName: undefined, fruit: undefined, forYou: true, lantern: null, canTakeDown: false }] };
    mine = empty;
    render("/garden/m_ana");
    expect(button("Hang a Lantern")).toBeUndefined();
  });

  test("in a teammate's garden a plant without a lantern can take yours, with a one-line note", () => {
    game = { enabled: true, hidden: false, sunlamps: 0, lanterns: 1 };
    of = { name: "Ana", avatarUrl: null, plants: [{ ...growing({}), forId: undefined, forName: undefined, fruit: undefined, forYou: false, lantern: null }] };
    mine = empty;
    render("/garden/m_ana");
    click(button("Hang a Lantern")!);
    const input = document.querySelector<HTMLInputElement>("input[aria-label='Lantern note']")!;
    expect(input.maxLength).toBe(80);
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(input, "Lovely oak");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(button("Hang it")!);
    expect(hangLantern).toHaveBeenCalledWith({ plantId: "p1", note: "Lovely oak" });
  });
});
