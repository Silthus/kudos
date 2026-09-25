// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { describeElement, parchmentTextOnDusk } from "@/testing/layout";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The garden pages (#95): your garden, planting, picking fruit, and the plants grown for you. */

let mine: unknown;
let forMe: unknown = [];
let of: unknown = null;
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
    return name === "gardens:mine" ? mine : name === "gardens:forMe" ? forMe : name === "gardens:of" ? of : name === "game:mine" ? game : undefined;
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
  plant.mockReset();
  pick.mockReset();
  uproot.mockReset();
  forMe = [];
  of = null;
  game = { enabled: true, hidden: false };
  useSunlamp.mockReset();
  hangLantern.mockReset();
  takeDownLantern.mockReset();
});

function render(path = "/garden") {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <ViewerContext.Provider value={viewer}>
          <Routes>
            <Route path="/garden" element={<Garden />} />
            <Route path="/garden/:memberId" element={<GardenOf />} />
          </Routes>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  // Text written for parchment never lands on the dusk ground (#127).
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
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
  ...extra,
});

test("an empty garden at level 3: one empty plot, and planting picks a teammate thanked this week", () => {
  mine = empty;
  const host = render();
  expect(host.querySelectorAll("[data-plot]")).toHaveLength(1);
  expect(text()).toContain("Empty plot");
  click(button("Plant a seed")!);
  expect(text()).toContain("10 Hog coins");
  click(document.querySelector('[data-candidate="m_cleo"]')!);
  click(button("Plant for 10 Hog coins")!);
  expect(plant).toHaveBeenCalledWith({ teammateId: "m_cleo" });
});

test("without a thoughtful kudos this week there's nobody to plant for, and it says how to get there", () => {
  mine = { ...empty, candidates: [] };
  render();
  expect(button("Plant a seed")?.hasAttribute("disabled")).toBe(true);
  expect(text()).toContain("Thank a teammate in Slack with a few words on why");
});

test("locked below level 3, with the plants grown for you still shown", () => {
  mine = { open: false, opensAt: 3 };
  forMe = [{ ...growing({}), ownerId: "m_ana", ownerName: "Ana", ownerAvatarUrl: null }];
  const host = render();
  expect(host.querySelector('[data-locked][aria-label="Your garden, opens at level 3"]')).not.toBeNull();
  expect(text()).toContain("Ana is growing a Helpful oak for you");
  expect(host.querySelector('a[href="/garden/m_ana"]')).not.toBeNull();
});

test("a plant shows its stage, whom it's for and what the next stage needs; a dormant one is autumn", () => {
  mine = { ...empty, plots: 2, plants: [growing({}), growing({ plantId: "p2", forName: "Cleo", dormant: true, stage: "young", stageName: "Young" })] };
  const host = render();
  const [first, second] = [...host.querySelectorAll("[data-plant]")];
  expect(first.textContent).toContain("Helpful oak");
  expect(first.textContent).toContain("for Ben");
  expect(first.textContent).toContain("Sapling");
  expect(first.textContent).toContain("2 of 4 waterings");
  expect(second.getAttribute("data-dormant")).toBe("true");
  expect(second.textContent).toContain("Dormant");
  expect(second.textContent).toContain("thank Cleo");
});

test("golden leaves from Super kudos show on your plant for them, and on the plant grown for you (#98)", () => {
  mine = { ...empty, plants: [growing({ goldenLeaves: 2 })] };
  forMe = [{ ...growing({}), ownerId: "m_ana", ownerName: "Ana", ownerAvatarUrl: null, goldenLeaves: 1 }];
  const host = render();
  expect(host.querySelector("[data-plant]")!.textContent).toContain("2 golden leaves");
  expect(text()).toContain("1 golden leaf from Ana's Super kudos");
});

test("the garden in the Keyboard garden look: PostHog's scene up top, each plant its species on a key bed, the gardener by an empty plot (#101)", () => {
  mine = {
    ...empty,
    plots: 3,
    plants: [growing({ species: "patient_pine", stage: "grown", stageName: "Grown", goldenLeaves: 1 }), growing({ plantId: "p2", forName: "Cleo", dormant: true, stage: "young", stageName: "Young" })],
    memories: [{ plantId: "p0", species: "bright_sunflower", speciesName: "Bright sunflower", stageName: "Grown", forName: "Dan", memoryDay: "2026-09-01", reason: "uprooted" }],
  };
  const host = render();
  expect(host.querySelector("[data-art-slot='garden-scene'] img")?.getAttribute("src")).toContain("keyboard_garden_dark_opt_15e213413c.png");
  const [pine, dormant] = [...host.querySelectorAll("[data-plant]")].map((p) => p.querySelector("svg")!);
  expect(pine.getAttribute("data-species")).toBe("patient_pine");
  expect(pine.querySelector("[data-bed=key]")).not.toBeNull();
  expect(pine.querySelectorAll("[data-golden-leaf]")).toHaveLength(1);
  expect(dormant.getAttribute("data-dormant")).toBe("true");
  expect(host.querySelector("[data-memories] svg")?.getAttribute("data-species")).toBe("bright_sunflower");
  expect(host.querySelector("[data-plot]:not([data-plant]) [data-art-slot='hoggie-empty-plot'] img")?.getAttribute("src")).toContain("/hoggies/png/gardener-2.png");
});

test("if the Keyboard garden can't load, the page stands as it was, with our own key beds (#101)", () => {
  mine = { ...empty, plants: [growing({})] };
  const host = render();
  act(() => void host.querySelector("[data-art-slot='garden-scene'] img")!.dispatchEvent(new Event("error")));
  expect(host.querySelector("[data-art-slot='garden-scene'] img")).toBeNull();
  expect(host.querySelector("[data-plant] [data-bed=key]")).not.toBeNull();
});

test("with the game off or hidden, or the garden still locked, the Keyboard garden stays out of the header (review #6)", () => {
  mine = null;
  game = { enabled: false, hidden: false };
  expect(render().querySelector("[data-art-slot='garden-scene']")).toBeNull();
  act(() => root?.unmount());
  mine = { open: false, opensAt: 3 };
  game = { enabled: true, hidden: false };
  expect(render().querySelector("[data-art-slot='garden-scene']")).toBeNull();
});

test("fruit waiting can be picked, and the week's caps are shown", () => {
  mine = { ...empty, plants: [growing({ stage: "grown", stageName: "Grown", fruit: [{ day: "2026-11-08", coins: 2 }, { day: "2026-11-09", coins: 1 }] })], harvest: { ...empty.harvest, weekCoins: 5, weekXp: 6 } };
  render();
  expect(text()).toContain("2 fruit waiting");
  expect(text()).toContain("5 of 14 Hog coins");
  click(button("Pick fruit")!);
  expect(pick).toHaveBeenCalledWith({});
});

test("uprooting asks first and keeps a memory", () => {
  mine = { ...empty, plants: [growing({})], memories: [{ plantId: "p0", species: "kind_maple", speciesName: "Kind maple", stageName: "Sprout", forName: "Dan", memoryDay: "2026-09-01", reason: "uprooted" }] };
  render();
  expect(text()).toContain("Kind maple for Dan");
  click(button("Uproot Helpful oak for Ben")!);
  click(button("Uproot")!);
  expect(uproot).toHaveBeenCalledWith({ plantId: "p1" });
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
  expect(text()).toContain("Ana's garden");
  expect(text()).toContain("Growing for you");
  expect(text()).not.toContain("Ben");
});

describe("the garden boosters (#97)", () => {
  test("a plant waiting on age takes a Sunlamp when you have one", () => {
    game = { enabled: true, hidden: false, sunlamps: 2, lanterns: 0 };
    mine = { ...empty, plants: [growing({ sunlamp: true, lantern: null }), growing({ plantId: "p2", forName: "Cleo", sunlamp: false, lantern: null })] };
    render();
    click(button("Use a Sunlamp on Helpful oak for Ben (2 left)")!);
    expect(useSunlamp).toHaveBeenCalledWith({ plantId: "p1" });
    expect(button("Use a Sunlamp on Helpful oak for Cleo (2 left)")).toBeUndefined();
  });

  test("without a Sunlamp there's no button", () => {
    game = { enabled: true, hidden: false, sunlamps: 0, lanterns: 0 };
    mine = { ...empty, plants: [growing({ sunlamp: true, lantern: null })] };
    render();
    expect(text()).not.toContain("Sunlamp");
  });

  test("a lantern shows its note and who hung it, and the owner can take it down", () => {
    mine = { ...empty, plants: [growing({ sunlamp: false, lantern: { note: "Keep growing!", by: "Cleo" } })] };
    render();
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
