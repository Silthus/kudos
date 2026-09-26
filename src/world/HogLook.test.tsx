// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let game: unknown;
const setLook = vi.fn(async (_: { color: string | null; accessory: string | null }) => null as unknown);
vi.mock("convex/react", () => ({ useQuery: () => game, useMutation: () => setLook }));
// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));
const { HogLookPicker } = await import("./HogLook");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const player = { level: 9, title: "Gardener", xp: 1650, floor: 1500, next: 2000 };
const mine = (look: { color: string | null; accessory: string | null }, p: unknown = player) => ({ enabled: true, hidden: false, player: p, wallet: null, luckyCharms: 0, sunlamps: 0, lanterns: 0, look });

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  setLook.mockReset();
  setLook.mockResolvedValue(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = () => act(() => root.render(<HogLookPicker />));
const preview = () => host.querySelector<HTMLCanvasElement>("[data-hog-preview] canvas[data-hog]")!;
const group = (name: string) => host.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`)!;
const choice = (groupName: string, label: string) => [...group(groupName).querySelectorAll("button")].find((b) => b.textContent === label)!;
const click = async (el: HTMLElement) => {
  await act(async () => el.click());
};

test("every Hedgehog Mode colour and accessory to choose from, and none", () => {
  game = mine({ color: null, accessory: null });
  render();
  expect(group("Colour").querySelectorAll("button")).toHaveLength(11);
  expect(group("Wearing").querySelectorAll("button")).toHaveLength(17);
  expect(choice("Colour", "None").getAttribute("aria-pressed")).toBe("true");
});

test("a colour shows on your hog at once, and is saved", async () => {
  game = mine({ color: null, accessory: "cap" });
  render();
  await click(choice("Colour", "Blue"));
  expect(preview().dataset.color).toBe("blue");
  expect(choice("Colour", "Blue").getAttribute("aria-pressed")).toBe("true");
  expect(setLook).toHaveBeenCalledWith({ color: "blue", accessory: "cap" });
});

test("something to wear, and taking it off", async () => {
  game = mine({ color: "red", accessory: null });
  render();
  await click(choice("Wearing", "Top hat"));
  expect(host.querySelector("[data-hog-preview] canvas[data-hog-accessory]")?.getAttribute("data-accessory")).toBe("tophat");
  expect(setLook).toHaveBeenLastCalledWith({ color: "red", accessory: "tophat" });
  await click(choice("Wearing", "None"));
  expect(setLook).toHaveBeenLastCalledWith({ color: "red", accessory: null });
});

test("refused, it says why and your hog goes back to its look", async () => {
  game = mine({ color: null, accessory: null });
  setLook.mockRejectedValue(new ConvexError("Your look is part of the game, which is off or hidden for you."));
  render();
  await click(choice("Colour", "Green"));
  expect(host.textContent).toContain("Your look is part of the game, which is off or hidden for you.");
  expect(preview().dataset.color).toBeUndefined();
});

test("before your first kudos there's no look to choose yet", () => {
  game = mine({ color: null, accessory: null }, null);
  render();
  expect(host.textContent).toContain("Your hog's look opens with your first kudos.");
  expect(host.querySelector('[role="group"]')).toBeNull();
});
