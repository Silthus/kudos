// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The garden pages (#95): your garden, planting, picking fruit, and the plants grown for you. */

let mine: unknown;
let forMe: unknown = [];
let of: unknown = null;
const plant = vi.fn();
const pick = vi.fn();
const uproot = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    return name === "gardens:mine" ? mine : name === "gardens:forMe" ? forMe : name === "gardens:of" ? of : name === "game:mine" ? { enabled: true, hidden: false } : undefined;
  },
  useMutation: (fn: FunctionReference<"mutation">) => {
    const name = getFunctionName(fn);
    return name === "gardens:plant" ? plant : name === "gardens:pick" ? pick : uproot;
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
