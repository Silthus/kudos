// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The offering stone's window (#157, plan #152 S3 and the seeds amendment): two rituals at one
 * stone. Givers offer the Hog coins their thoughtful kudos left waiting (coins drop from the canopy
 * into the wallet, the tree glows once, the fruit is revealed one by one in a ledger); receivers
 * plant the seeds their teammates sowed (the seeds sink into the roots and the tree glows once).
 */

let pending: unknown;
let tree: unknown;
const claim = vi.fn();
const plantSeeds = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "offerings:pending": pending, "tree:state": tree })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) => (getFunctionName(fn) === "offerings:claim" ? claim : plantSeeds),
}));

const { Offering } = await import("./Offering");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const treeState = (patch: Record<string, unknown> = {}) => ({
  planted: true,
  stage: "grown",
  growth: 400,
  peakGrowth: 400,
  sap: 380,
  fuel: 40,
  rings: 0,
  worldSeed: 7,
  seedsToPlant: 0,
  hasSeedsToPlant: false,
  ...patch,
});

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  claim.mockReset();
  plantSeeds.mockReset();
});

const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
/** The page in its window (#128): a parchment face and a size container. */
const ui = () => (
  <MemoryRouter initialEntries={["/offering"]}>
    <ViewerContext.Provider value={viewer}>
      <div data-window-body className="@container pixel-frame">
        <Offering />
      </div>
    </ViewerContext.Provider>
  </MemoryRouter>
);

function render() {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(ui()));
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const text = () => document.body.textContent ?? "";
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
const count = (selector: string) => document.querySelectorAll(selector).length;

describe("the stone's window", () => {
  test("says how many Hog coins wait for you and offers them", () => {
    pending = { coins: 12, fuel: 6, offerings: 4 };
    tree = treeState();
    render();
    expect(text()).toContain("12 Hog coins waiting for you");
    expect(button("Offer your appreciation")).toBeDefined();
  });

  test("below level 3 it says something waits, never how many coins", () => {
    pending = { coins: null, fuel: 2, offerings: 2 };
    tree = treeState();
    render();
    expect(text()).toContain("Your appreciation is waiting");
    expect(text()).not.toMatch(/\d+ Hog coins/);
    expect(button("Offer your appreciation")).toBeDefined();
  });

  test("with nothing waiting it says how appreciation gets here, and offers nothing", () => {
    pending = { coins: 0, fuel: 0, offerings: 0 };
    tree = treeState();
    render();
    expect(text()).toContain("Nothing waiting at the stone");
    expect(button("Offer your appreciation")).toBeUndefined();
    expect(text()).toContain("No seeds to plant");
    expect(button("Plant your seeds")).toBeUndefined();
  });

  test("says how many seeds you have to plant, or just that you have some where counts are hidden", () => {
    pending = { coins: 0, fuel: 0, offerings: 0 };
    tree = treeState({ seedsToPlant: 3, hasSeedsToPlant: true });
    render();
    expect(text()).toContain("3 seeds to plant");
    expect(button("Plant your seeds")).toBeDefined();
    tree = treeState({ seedsToPlant: null, hasSeedsToPlant: true });
    render();
    expect(text()).toContain("Seeds to plant");
    expect(text()).not.toMatch(/\d+ seeds? to plant/);
  });

  test("nothing but a note while the game isn't shown to you", () => {
    pending = null;
    tree = null;
    render();
    expect(text()).toContain("The offering stone is part of the game");
  });
});

describe("offering your appreciation", () => {
  test("drops the coins into your wallet, lights the tree once and reveals the fruit in a ledger", async () => {
    pending = { coins: 12, fuel: 6, offerings: 4 };
    tree = treeState();
    claim.mockResolvedValue({ coins: 12, fuel: 6, offerings: 4, fruit: ["sun", "amber"], more: false });
    render();
    await act(async () => button("Offer your appreciation")!.click());
    expect(claim).toHaveBeenCalledWith({});
    expect(count("[data-coin-flight]")).toBeGreaterThan(0);
    expect(count("[data-sap-burst]")).toBe(1);
    // With nothing left waiting, the card says what just happened, not "nothing waiting".
    pending = { coins: 0, fuel: 0, offerings: 0 };
    act(() => root!.render(ui()));
    expect(text()).toContain("You offered your appreciation");
    expect(text()).not.toContain("Nothing waiting at the stone");
    const ledger = document.querySelector("[data-ledger]")!;
    expect(ledger.textContent).toContain("12 Hog coins into your wallet");
    expect([...ledger.querySelectorAll("[data-fruit]")].map((f) => f.getAttribute("data-fruit"))).toEqual(["sun", "amber"]);
    expect(ledger.textContent).toContain("Sun fruit");
    expect(ledger.textContent).toContain("Amber fruit");
    // The burst plays once: the next look at the stone doesn't light it again.
    pending = { coins: 0, fuel: 0, offerings: 0 };
    act(() => root!.render(ui()));
    expect(count("[data-sap-burst]")).toBe(1);
    expect(document.querySelector("[data-ledger]")).not.toBeNull();
  });

  test("a claim with no fruit says when the next one drops", async () => {
    pending = { coins: 3, fuel: 1, offerings: 1 };
    tree = treeState();
    claim.mockResolvedValue({ coins: 3, fuel: 1, offerings: 1, fruit: [], more: false });
    render();
    await act(async () => button("Offer your appreciation")!.click());
    expect(document.querySelector("[data-ledger]")!.textContent).toContain("A fruit drops for every 5 Hog coins you offer");
  });
});

describe("planting your seeds", () => {
  test("sinks the seeds into the roots, lights the tree once and says how many were planted", async () => {
    pending = { coins: 0, fuel: 0, offerings: 0 };
    tree = treeState({ seedsToPlant: 3, hasSeedsToPlant: true });
    plantSeeds.mockResolvedValue({ planted: 3, more: false });
    render();
    await act(async () => button("Plant your seeds")!.click());
    expect(plantSeeds).toHaveBeenCalledWith({});
    expect(count("[data-seed-sink]")).toBe(3);
    expect(count("[data-sap-burst]")).toBe(1);
    expect(text()).toContain("You planted 3 seeds");
    tree = treeState({ seedsToPlant: 0, hasSeedsToPlant: false });
    act(() => root!.render(ui()));
    expect(text()).toContain("You planted your seeds");
    expect(text()).not.toContain("No seeds to plant");
  });
});
