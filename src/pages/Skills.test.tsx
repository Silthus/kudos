// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, expect, test, vi } from "vitest";

let tree: unknown;
const take = vi.fn();
const reset = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "skills:mine" ? tree : undefined),
  useMutation: (fn: FunctionReference<"mutation">) => (getFunctionName(fn) === "skills:take" ? take : reset),
}));

const { Skills } = await import("./Skills");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom cancels Web Animations with an unhandled AbortError; the dialogs don't need to animate here.
MotionGlobalConfig.skipAnimations = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  take.mockReset();
  reset.mockReset();
});

// happy-dom has no <dialog> modal; the shared Dialog only needs these two.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

function render() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    ),
  );
  return host;
}

const node = (host: HTMLElement, name: string) => host.querySelector<HTMLButtonElement>(`[data-skill][aria-label^="${name}"]`)!;
const click = (el: Element) => act(() => (el as HTMLElement).click());
const buttonNamed = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

test("shows the points to spend, the four branches and the tiers still ahead, visible but locked", () => {
  tree = { level: 6, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: 42 };
  const host = render();
  expect(host.textContent).toContain("4 skill points to spend"); // 5 earned, 1 spent
  for (const branch of ["Gardener", "Herald", "Scout", "Neighbour"]) expect(host.textContent).toContain(branch);
  const tiers = [...host.querySelectorAll("[data-tier]")].map((t) => t.getAttribute("aria-label"));
  expect(tiers).toContain("Scout tier 3, opens at level 10");
  expect(tiers).toContain("Scout tier 2, open");
  expect(node(host, "Lookout").getAttribute("aria-label")).toBe("Lookout, rank 1 of 1");
  expect(node(host, "Trailblazer").getAttribute("aria-label")).toContain("opens at level 20");
});

test("choosing a skill that can be taken opens it; Take it spends a point on it", async () => {
  tree = { level: 6, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: 42 };
  const host = render();
  click(node(host, "Rekindler"));
  expect(document.body.textContent).toContain("A bigger rekindle bonus");
  await act(async () => buttonNamed("Take it")!.click());
  expect(take).toHaveBeenCalledWith({ skill: "rekindler" });
});

test("a skill whose system hasn't shipped says what it arrives with and can't be taken", () => {
  tree = { level: 6, skills: {}, resets: 0, resetCost: 50, balance: 42 };
  const host = render();
  click(node(host, "More plots"));
  expect(document.body.textContent).toContain("More plots arrives with Gardens.");
  expect(buttonNamed("Take it")).toBeUndefined();
});

test("resetting asks first, with the price, the next price and the balance, then charges the price shown", async () => {
  tree = { level: 6, skills: { lookout: 1, pathfinder: 2 }, resets: 1, resetCost: 100, balance: 120 };
  render();
  click(buttonNamed("Reset tree")!);
  const text = document.body.textContent!;
  expect(text).toContain("All 3 skill points come back");
  expect(text).toContain("This reset costs 100 Hog coins; the next one will cost 200.");
  expect(text).toContain("You have 120 Hog coins.");
  await act(async () => buttonNamed("Reset for 100 Hog coins")!.click());
  expect(reset).toHaveBeenCalledWith({ cost: 100 });
});

test("a reset the balance can't pay for can't be confirmed", () => {
  tree = { level: 6, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: 20 };
  render();
  click(buttonNamed("Reset tree")!);
  expect(buttonNamed("Reset for 50 Hog coins")!.disabled).toBe(true);
});

test("on a phone one branch shows at a time, picked with the branch switcher", () => {
  tree = { level: 6, skills: {}, resets: 0, resetCost: 50, balance: 0 };
  const host = render();
  const column = (id: string) => host.querySelector(`[data-branch="${id}"]`)!;
  expect(column("scout").className).not.toMatch(/(^|\s)hidden(\s|$)/);
  expect(column("herald").className).toMatch(/(^|\s)hidden(\s|$)/);
  click([...host.querySelectorAll("[role=tab]")].find((t) => t.textContent === "Herald")!);
  expect(column("herald").className).not.toMatch(/(^|\s)hidden(\s|$)/);
  expect(column("scout").className).toMatch(/(^|\s)hidden(\s|$)/);
});

test("without a tree (game off or hidden, or no kudos yet) it says how to start one", () => {
  tree = null;
  const host = render();
  expect(host.textContent).toContain("Your skill tree starts with your first kudos");
});
