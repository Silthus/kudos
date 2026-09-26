// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";

/** Tree fruit (#157): the shelf in your cabin, and the stall where fruit is sold or used. */

let inventory: unknown;
let game: unknown = { enabled: true, hidden: false };
const applyFruit = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "offerings:inventory": inventory, "game:mine": game })[getFunctionName(fn)],
  useMutation: () => applyFruit,
}));

const { FruitShelf, FruitStall } = await import("./fruit");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const held = [
  { fruit: "sun", name: "Sun fruit", about: "Sells for 3 Hog coins at the stall.", count: 2 },
  { fruit: "heart", name: "Heart fruit", about: "A Super seed: plants a garden plant that starts as a Sapling.", count: 1 },
];

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  applyFruit.mockReset();
  game = { enabled: true, hidden: false };
});

function render(ui: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <div data-window-body className="@container pixel-frame">
          {ui}
        </div>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);

describe("the fruit shelf in your cabin", () => {
  test("shows each fruit you hold with how many, and the way to the stall", () => {
    inventory = held;
    const host = render(<FruitShelf />);
    const shelf = host.querySelector("[data-fruit-shelf]")!;
    expect([...shelf.querySelectorAll("[data-fruit]")].map((f) => [f.getAttribute("data-fruit"), f.textContent])).toEqual([
      ["sun", expect.stringContaining("Sun fruit, 2")],
      ["heart", expect.stringContaining("Heart fruit, 1")],
    ]);
    expect(shelf.querySelector("a[href='/store']")?.textContent).toBe("Sell or use them at the stall");
  });

  test("an empty shelf says where fruit comes from; nothing while the game isn't shown", () => {
    inventory = [];
    expect(render(<FruitShelf />).textContent).toContain("Offer your appreciation at the stone");
    act(() => root!.unmount());
    game = { enabled: true, hidden: true };
    expect(render(<FruitShelf />).querySelector("[data-fruit-shelf]")).toBeNull();
  });
});

describe("fruit at the stall", () => {
  test("each fruit has its one action, and says what it did", async () => {
    inventory = held;
    applyFruit.mockResolvedValue({ said: "Sold for 3 Hog coins.", coins: 3 });
    render(<FruitStall />);
    expect(button("Sell for 3 Hog coins")).toBeDefined();
    expect(button("Take a Super seed")).toBeDefined();
    await act(async () => button("Sell for 3 Hog coins")!.click());
    expect(applyFruit).toHaveBeenCalledWith({ fruit: "sun" });
    expect(document.body.textContent).toContain("Sold for 3 Hog coins.");
    expect(document.querySelectorAll("[data-coin-flight]").length).toBe(3); // the coins hop to your wallet
  });

  test("no fruit, no shelf at the stall", () => {
    inventory = [];
    expect(render(<FruitStall />).querySelector("[data-shelf='fruit']")).toBeNull();
  });
});
