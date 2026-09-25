// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, expect, test, vi } from "vitest";
import { InWindow, windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/** The store stall (#91, #131): Hog coins only, closed until level 5, game items on the first shelf, real rewards on the second. */

let shop: unknown;
let catalog: unknown;
let myRedemptions: unknown[] = [];
const buyItem = vi.fn();
const handBack = vi.fn();
const cancel = vi.fn();

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
  useMutation: (fn: FunctionReference<"mutation">) => {
    const name = getFunctionName(fn);
    return name === "store:buyItem" ? buyItem : name === "demo:handBackRewards" ? handBack : name === "store:cancel" ? cancel : vi.fn();
  },
}));

const { Store } = await import("./Store");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;
// happy-dom has no <dialog> modal; the shared Dialog only needs these two.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  myRedemptions = [];
  catalog = undefined;
  buyItem.mockReset();
  handBack.mockReset();
  cancel.mockReset();
});

let lastViewer: ReadyViewer;
const root_children = () => (
  <MemoryRouter>
    <ViewerContext.Provider value={lastViewer}>
      <InWindow>
        <Store />
      </InWindow>
    </ViewerContext.Provider>
  </MemoryRouter>
);
function render({ isDemo = false, isAdmin = false } = {}) {
  act(() => root?.unmount());
  const viewer = {
    member: { _id: "m1", name: "Alex Rivera", isAdmin },
    workspace: { name: "Lumen Labs", emojiGlyph: "🌮", timezone: "Europe/Berlin", isDemo, storeEnabled: true },
  } as unknown as ReadyViewer;
  lastViewer = viewer;
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer}>
          <InWindow>
            <Store />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const click = (el: Element) => act(() => (el as HTMLElement).click());
const buttonNamed = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

const spreeJoin = { key: "spreeJoin", name: "Extra spree join", description: "One more kudos spree to join this month.", price: 8, perMonth: 5, boughtThisMonth: 1, affordable: true, blocked: null };
const skillReset = { key: "skillReset", name: "Skill-tree reset", description: "Returns every skill point.", price: 50, perMonth: null, boughtThisMonth: 0, affordable: true, blocked: "Your tree has no skills to reset." };

test("below level 5 the stall is closed, with a Locked note on how to get there and the coins waiting", () => {
  shop = { access: "locked", level: 4, unlockLevel: 5, how: "At level 5 you can spend Hog coins on game items.", balance: 197 };
  const host = render();
  expect(host.querySelector("[data-stall]")?.getAttribute("data-stall")).toBe("closed");
  expect(host.textContent).toContain("The stall opens at level 5");
  expect(host.querySelector("[data-locked]")?.textContent).toContain("At level 5 you can spend Hog coins on game items.");
  expect(host.textContent).toContain("You're level 4. Your 197 Hog coins wait for you here.");
  expect(host.querySelector("button[aria-label^='Buy']")).toBeNull();
});

test("while closed, a member's own requests still show", () => {
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

test("open, the game items stand on a shelf in Hog coins with what's left this month; items not for sale yet say why", () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin, skillReset, { ...spreeJoin, key: "lantern", name: "Lantern", perMonth: 2, boughtThisMonth: 2, affordable: true, blocked: "You've bought all 2 this month." }] };
  const host = render();
  expect(host.querySelector("[data-balance]")?.textContent).toBe("You have 267 Hog coins to spend");
  const goods = [...host.querySelectorAll<HTMLElement>("[data-shelf='game-items'] [data-good]")];
  expect(goods.map((g) => g.dataset.good)).toEqual(["spreeJoin", "skillReset", "lantern"]);
  expect(goods[0].textContent).toContain("4 left this month");
  expect(goods[2].textContent).toContain("None left this month");
  expect(goods[1].textContent).not.toContain("this month");
  expect(host.querySelector<HTMLButtonElement>("button[aria-label='Buy Extra spree join']")?.disabled).toBe(false);
  expect(host.querySelector<HTMLButtonElement>("button[aria-label='Skill-tree reset: Your tree has no skills to reset.']")?.disabled).toBe(true);
  expect(goods[1].textContent).toContain("Your tree has no skills to reset.");
  // A good not for sale is dimmed, but the reason stays readable.
  expect(goods[1].querySelector("[data-reason]")?.closest("[class*='opacity-']")).toBeNull();
  expect(host.querySelector("[data-shelf='rewards']")).toBeNull();
});

test("your balance and every price carry the Hog coin with Max (#101)", () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin, skillReset] };
  const host = render();
  expect(host.querySelector("[data-balance] [data-hog-coin]")).not.toBeNull();
  const prices = [...host.querySelectorAll("[data-good] [data-price]")];
  expect(prices.map((p) => p.textContent)).toEqual(["8 Hog coins", "50 Hog coins"]);
  for (const price of prices) expect(price.querySelector("[data-hog-coin] [data-art-slot='coin-max']")).not.toBeNull();
});

test("Buy asks first with the balance before and after, then buys at the price shown and says it's yours", async () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin] };
  buyItem.mockResolvedValue({ balance: 259 });
  const host = render();
  click(host.querySelector("button[aria-label='Buy Extra spree join']")!);
  const text = document.body.textContent!;
  expect(text).toContain("Buy Extra spree join?");
  expect(text).toContain("Balance after");
  expect(text).toContain("259 Hog coins");
  await act(async () => buttonNamed("Buy for 8 Hog coins")!.click());
  expect(buyItem).toHaveBeenCalledWith({ item: "spreeJoin", expectedPrice: 8 });
  expect(document.body.textContent).toContain("Extra spree join is yours");
  expect(document.body.textContent).toContain("Balance: 259 Hog coins");
});

test("a negative balance blocks buying and says why", () => {
  shop = { access: "open", balance: -3, realRewards: false, items: [{ ...spreeJoin, affordable: false }] };
  const host = render();
  expect(host.querySelector<HTMLButtonElement>("button[aria-label^='Extra spree join:']")?.disabled).toBe(true);
  expect(host.textContent).toContain("Spending waits until it's above zero again");
});

test("with real rewards on they fill a second shelf, and My requests is a ledger with each request's status", () => {
  shop = { access: "open", balance: 80, realRewards: true, items: [spreeJoin] };
  catalog = {
    enabled: true,
    balance: 80,
    openCount: 1,
    maxOpen: 3,
    rewards: [
      { _id: "w1", name: "Team lunch", emoji: "🍕", cost: 60, affordable: true, soldOut: false, limitReached: false },
      { _id: "w2", name: "Hoodie", emoji: "🧥", cost: 120, affordable: false, soldOut: false, limitReached: false },
    ],
  };
  myRedemptions = [{ _id: "r1", rewardName: "Stickers", rewardEmoji: "✨", cost: 20, status: "approved", requestedAt: 1, updatedAt: 2, history: [] }];
  const host = render();
  const shelf = host.querySelector("[data-shelf='rewards']")!;
  expect(shelf.textContent).toContain("Team lunch");
  expect(shelf.textContent).toContain("2 rewards, and you can afford 1.");
  expect(host.querySelector<HTMLButtonElement>("button[aria-label='Redeem Team lunch']")?.disabled).toBe(false);
  expect(host.querySelector<HTMLButtonElement>("button[aria-label^='Hoodie:']")?.disabled).toBe(true);
  const ledger = host.querySelector("[data-ledger]")!;
  expect(ledger.textContent).toContain("My requests");
  expect(ledger.textContent).toContain("Stickers");
  expect(ledger.textContent).toContain("Approved");
});

test("with real rewards off, a member's own requests still show, so open ones don't disappear", () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  myRedemptions = [{ _id: "r1", rewardName: "Hoodie", rewardEmoji: "🧥", cost: 60, status: "approved", requestedAt: 1, updatedAt: 2, history: [] }];
  const host = render();
  expect(host.textContent).toContain("My requests");
  expect(host.textContent).toContain("Hoodie");
});

test("with real rewards off and no requests, nothing about rewards shows", () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  expect(render().textContent).not.toContain("My requests");
});

test("in the demo a small sign hands back what visitors bought", async () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  handBack.mockResolvedValue(null);
  render({ isDemo: true });
  await act(async () => buttonNamed("Hand back what I bought")!.click());
  expect(handBack).toHaveBeenCalledTimes(1);
  expect(buttonNamed("Hand back what I bought")!.disabled).toBe(false); // ready again once it's done
  expect(render().textContent).not.toContain("Hand back");
});

test("a price that changed while the Buy dialog was open can't be bought at the old price", () => {
  shop = { access: "open", balance: 267, realRewards: false, items: [spreeJoin] };
  const host = render();
  click(host.querySelector("button[aria-label='Buy Extra spree join']")!);
  shop = { access: "open", balance: 267, realRewards: false, items: [{ ...spreeJoin, price: 10 }] };
  act(() => root!.render(root_children()));
  expect(document.body.textContent).toContain("The price changed to 10 Hog coins");
  expect(buttonNamed("Buy for 8 Hog coins")!.disabled).toBe(true);
});

test("a pending request can be cancelled from the ledger, after a second click; a failure says so", async () => {
  shop = { access: "open", balance: 50, realRewards: false, items: [spreeJoin] };
  myRedemptions = [{ _id: "r1", rewardName: "Hoodie", rewardEmoji: "🧥", cost: 60, status: "pending", requestedAt: 1, updatedAt: 2, history: [] }];
  cancel.mockRejectedValue(new Error("nope"));
  render();
  click(buttonNamed("Cancel")!);
  expect(buttonNamed("Keep")).toBeDefined();
  await act(async () => buttonNamed("Cancel request")!.click());
  expect(cancel).toHaveBeenCalledWith({ redemptionId: "r1" });
  expect(document.querySelector("[data-ledger] [role=alert]")?.textContent).toContain("Couldn't cancel the request.");
});

test("an empty rewards shelf says so, and shows admins where to stock it", () => {
  shop = { access: "open", balance: 50, realRewards: true, items: [spreeJoin] };
  catalog = { enabled: true, balance: 50, openCount: 0, maxOpen: 3, rewards: [] };
  const host = render({ isAdmin: true });
  const shelf = host.querySelector("[data-shelf='rewards']")!;
  expect(shelf.textContent).toContain("The shelf is empty");
  expect(shelf.querySelector("a[href='/admin?tab=store&section=catalog']")?.textContent).toBe("Add rewards");
  expect(shelf.querySelector("ul")).toBeNull();
});

test("off and hidden are notes, without any balance", () => {
  shop = { access: "off" };
  expect(render().textContent).toContain("The Store comes with the game");
  shop = { access: "hidden" };
  const hidden = render();
  expect(hidden.textContent).toContain("You've hidden the game");
  expect(hidden.querySelector("a[href='/me']")?.textContent).toBe("Show the game in your cabin");
});
