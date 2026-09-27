// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The overview (#163, plan #152 S1): the whole tree from above at the elder stage: the tree and its
 * rings, the districts as icons (open ones lit), the ruins as markers (the ones you've cleared lit),
 * how many homes stand on the ring, the blight, and a way to walk to each open district.
 */

let overview: unknown;
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "tree:overview": overview })[getFunctionName(fn)],
}));

const { Overview } = await import("./Overview");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

const viewer = (isAdmin = false) =>
  ({ member: { _id: "m_ana", name: "Ana", isAdmin }, workspace: { timezone: "Europe/Berlin", isDemo: true, gameEnabled: true, storeEnabled: false, questsEnabled: true } }) as unknown as ReadyViewer;

function render(isAdmin = false) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer(isAdmin)}>
          <div data-window-body className="@container pixel-frame">
            <Overview />
          </div>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}

const map = {
  stage: "elder",
  stageName: "an elder tree",
  growth: 3420,
  rings: 0,
  next: { stage: "world_tree", growth: 4580 },
  tree: { x: 0, y: 0 },
  districts: [
    { id: "base_camp", name: "Base camp", at: { x: 0, y: 0 }, open: true, opensAt: "a seed" },
    { id: "terrace", name: "The terraces", at: { x: 8, y: -6 }, open: true, opensAt: "a sapling" },
    { id: "gatehouse", name: "The gatehouse", at: { x: -12, y: 10 }, open: true, opensAt: "a grown tree" },
    { id: "near_ruins", name: "The near ruins", at: { x: 19, y: 2 }, open: true, opensAt: "a great tree" },
    { id: "crew", name: "The crew's plaque", at: { x: 5, y: 6 }, open: true, opensAt: "a great tree" },
    { id: "blight", name: "The blight stone", at: { x: 3, y: -4 }, open: true, opensAt: "an ancient tree" },
    { id: "canopy", name: "The canopy", at: { x: -3, y: -21 }, open: false, opensAt: "the world tree" },
  ],
  ruins: [
    { id: "ruin:1:0", name: "The Salt Well", tier: 1, at: { x: 60, y: 0 }, explored: true },
    { id: "ruin:1:1", name: "The Amber Vault", tier: 1, at: { x: -30, y: 52 }, explored: false },
    { id: "ruin:3:0", name: "The Silent Stair", tier: 3, at: { x: 0, y: -180 }, explored: false },
  ],
  homes: 10,
  plots: 24,
  blight: null,
};

describe("the overview", () => {
  test("draws the tree, its rings, the districts and the ruins, the explored ones lit", () => {
    overview = map;
    const host = render();
    expect(host.querySelector("svg[data-overview-map]")).not.toBeNull();
    expect(host.querySelector("[data-map-tree]")).not.toBeNull();
    expect(host.querySelectorAll("[data-map-ring]").length).toBeGreaterThanOrEqual(3);
    expect(host.querySelector("[data-map-district='terrace'][data-open='true']")).not.toBeNull();
    expect(host.querySelector("[data-map-district='canopy'][data-open='false']")).not.toBeNull();
    expect(host.querySelector("[data-map-ruin='ruin:1:0'][data-explored='true']")).not.toBeNull();
    expect(host.querySelector("[data-map-ruin='ruin:1:1'][data-explored='false']")).not.toBeNull();
  });

  test("says the tree's stage, the homes on the ring, the ruins explored and the blight", () => {
    overview = map;
    const host = render();
    const text = host.textContent ?? "";
    expect(text).toContain("An elder tree");
    expect(text).toContain("10 homes on 24 plots");
    expect(text).toContain("1 of 3 ruins explored");
    expect(text).toContain("No blight on the tree.");
  });

  test("walks you to each open district you can go to; a closed one says when it opens", () => {
    overview = map;
    const host = render();
    const row = (id: string) => host.querySelector(`[data-district-row='${id}']`)!;
    expect(row("terrace").querySelector("a")?.getAttribute("href")).toBe("/garden");
    expect(row("base_camp").querySelector("a")?.getAttribute("href")).toBe("/offering");
    expect(row("near_ruins").querySelector("a")?.getAttribute("href")).toBe("/ruins/1-0");
    expect(row("gatehouse").querySelector("a")).toBeNull(); // only admins have it
    expect(row("crew").querySelector("a")?.getAttribute("href")).toBe("/crew"); // the crew's plaque (#161)
    expect(row("blight").querySelector("a")?.getAttribute("href")).toBe("/blight"); // the blight stone (#164)
    expect(row("canopy").textContent).toContain("Opens when the tree is the world tree");
    act(() => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    const admin = render(true);
    expect(admin.querySelector("[data-district-row='gatehouse'] a")?.getAttribute("href")).toBe("/admin");
  });

  test("before the elder stage there's nothing to show", () => {
    overview = null;
    const host = render();
    expect(host.textContent).toContain("The overview opens when the tree is an elder tree.");
  });
});
