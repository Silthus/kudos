// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { describeElement, parchmentTextOnDusk } from "@/testing/layout";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The Store page (#91): Hog coins only, locked until level 5, game items first, real rewards behind the admin switch. */

let shop: unknown;
let catalog: unknown;
let myRedemptions: unknown[] = [];

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    if (name === "store:shop") return shop;
    if (name === "store:catalog") return catalog;
    return undefined;
  },
  usePaginatedQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    return { results: name === "store:myRedemptions" ? myRedemptions : [], status: "Exhausted", loadMore: () => {} };
  },
  useMutation: () => vi.fn(),
}));

const { Store } = await import("./Store");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  myRedemptions = [];
  catalog = undefined;
});

function render() {
  const viewer = {
    member: { _id: "m1", name: "Alex Rivera", isAdmin: false },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", timezone: "Europe/Berlin", isDemo: false, storeEnabled: true },
  } as unknown as ReadyViewer;
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <Store />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  // Text written for parchment never lands on the dusk ground (#127).
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
  return host;
}

const spreeJoin = { key: "spreeJoin", name: "Extra spree join", description: "One more kudos spree to join this month.", price: 8, perMonth: 5, boughtThisMonth: 1, affordable: true, blocked: null };
const skillReset = { key: "skillReset", name: "Skill-tree reset", description: "Returns every skill point.", price: 50, perMonth: null, boughtThisMonth: 0, affordable: true, blocked: "Your tree has no skills to reset." };

test("below level 5 the Store is visible but locked, with how to get there and the coins waiting", () => {
  shop = { access: "locked", level: 4, unlockLevel: 5, how: "At level 5 you can spend Hog coins on game items.", balance: 197 };
  const host = render();
  expect(host.textContent).toContain("Opens at level 5");
  expect(host.querySelector("[data-locked]")?.textContent).toContain("At level 5 you can spend Hog coins on game items.");
  expect(host.textContent).toContain("You're level 4. Your 197 Hog coins wait for you here.");
  expect(host.querySelector("button[aria-label^='Buy']")).toBeNull();
});

test("while locked, a member's own requests still show", () => {
  shop = { access: "locked", level: 2, unlockLevel: 5, how: "At level 5 you can spend Hog coins on game items.", balance: null };
  myRedemptions = [{ _id: "r1", rewardName: "Hoodie", rewardEmoji: "🧥", cost: 50, status: "pending", requestedAt: 1, updatedAt: 1, history: [], legacy: true }];
  const host = render();
  expect(host.textContent).toContain("My requests");
  expect(host.textContent).toContain("50 kudos");
  expect(host.textContent).toContain("old kudos Store");
});

test("below the wallet's level not even the amount shows", () => {
  shop = { access: "locked", level: 2, unlockLevel: 5, how: "At level 5 you can spend Hog coins on game items.", balance: null };
  expect(render().textContent).not.toMatch(/\d+ Hog coins/);
});

test("open, it lists the game items in Hog coins, with items not for sale yet disabled and saying why", () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin, skillReset] };
  const host = render();
  expect(host.textContent).toContain("You have 267 Hog coins to spend");
  expect(host.querySelector<HTMLButtonElement>("button[aria-label='Buy Extra spree join']")?.disabled).toBe(false);
  expect(host.textContent).toContain("1/5 this month");
  expect(host.querySelector<HTMLButtonElement>("button[aria-label='Skill-tree reset: Your tree has no skills to reset.']")?.disabled).toBe(true);
  expect(host.textContent).not.toContain("Rewards");
});

test("your balance and every price carry the Hog coin with Max (#101)", () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin, skillReset] };
  const host = render();
  expect(host.querySelector("h1 [data-hog-coin]")).not.toBeNull();
  const cards = [...host.querySelectorAll("button[aria-label^='Buy'], button[aria-label^='Skill-tree reset:']")].map((b) => b.closest("article, section, li, div.flex-col") ?? b.parentElement!.parentElement!);
  expect(cards).toHaveLength(2);
  for (const card of cards) expect(card.querySelector("[data-hog-coin] [data-art-slot='coin-max']")).not.toBeNull();
});

test("a negative balance blocks buying and says why", () => {
  shop = { access: "open", balance: -3, realRewards: false, items: [{ ...spreeJoin, affordable: false }] };
  const host = render();
  expect(host.querySelector<HTMLButtonElement>("button[aria-label^='Extra spree join:']")?.disabled).toBe(true);
  expect(host.textContent).toContain("Spending waits until it's above zero again");
});

test("with real rewards off, a member's own requests still show, so open ones don't disappear", () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  myRedemptions = [
    { _id: "r1", rewardName: "Hoodie", rewardEmoji: "🧥", cost: 60, status: "approved", requestedAt: 1, updatedAt: 2, history: [] },
  ];
  const host = render();
  expect(host.textContent).toContain("My requests");
  expect(host.textContent).toContain("Hoodie");
});

test("with real rewards off and no requests, nothing about rewards shows", () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  expect(render().textContent).not.toContain("My requests");
});

test("off and hidden say so, without any balance", () => {
  shop = { access: "off" };
  expect(render().textContent).toContain("The Store comes with the game");
  act(() => root?.unmount());
  shop = { access: "hidden" };
  expect(render().textContent).toContain("You've hidden the game");
});
