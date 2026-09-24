// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, expect, test, vi } from "vitest";

let tree: unknown;
let game: unknown = { enabled: true, hidden: false, player: { level: 6 } };
const take = vi.fn();
const reset = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => {
    const name = getFunctionName(fn);
    return name === "skills:mine" ? tree : name === "game:mine" ? game : undefined;
  },
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
  game = { enabled: true, hidden: false, player: { level: 6 } };
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
  rerender();
  return host;
}
function rerender() {
  act(() =>
    root!.render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    ),
  );
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

test("choosing a skill that can be taken opens it; Take it spends a point on it, once, and closes", async () => {
  tree = { level: 6, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: 42 };
  let done!: () => void;
  take.mockReturnValue(new Promise<void>((resolve) => (done = resolve)));
  const host = render();
  click(node(host, "Rekindler"));
  expect(document.body.textContent).toContain("A bigger rekindle bonus");
  click(buttonNamed("Take it")!);
  expect(buttonNamed("Take it")!.disabled).toBe(true); // a double tap can't spend a second point
  click(buttonNamed("Take it")!);
  expect(take).toHaveBeenCalledTimes(1);
  expect(take).toHaveBeenCalledWith({ skill: "rekindler" });
  await act(async () => done());
  expect(buttonNamed("Take it")).toBeUndefined();
});

test("a skill blocked only by points says so to screen readers", () => {
  tree = { level: 2, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: null };
  const host = render();
  expect(node(host, "Pathfinder").getAttribute("aria-label")).toBe("Pathfinder, rank 0 of 2, needs 1 skill point");
});

test("a skill whose system hasn't shipped says what it arrives with and can't be taken", () => {
  tree = { level: 6, skills: {}, resets: 0, resetCost: 50, balance: 42 };
  const host = render();
  click(node(host, "Good neighbour"));
  expect(document.body.textContent).toContain("Good neighbour arrives with the team garden and bonus days.");
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

test("the reset charges the price shown when it was asked, even if the price moves meanwhile", async () => {
  tree = { level: 6, skills: { lookout: 1 }, resets: 1, resetCost: 100, balance: 500 };
  render();
  click(buttonNamed("Reset tree")!);
  tree = { level: 6, skills: { lookout: 1 }, resets: 2, resetCost: 200, balance: 500 };
  rerender();
  expect(document.body.textContent).toContain("This reset costs 100 Hog coins");
  await act(async () => buttonNamed("Reset for 100 Hog coins")!.click());
  expect(reset).toHaveBeenCalledWith({ cost: 100 }); // the server refuses it: the price changed
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

test("without a tree it says why: no kudos yet, the game hidden, or the game off", () => {
  tree = null;
  game = { enabled: true, hidden: false, player: null };
  expect(render().textContent).toContain("Your skill tree starts with your first kudos");
  act(() => root?.unmount());
  game = { enabled: true, hidden: true, player: null };
  expect(render().textContent).toContain("The game is hidden");
  act(() => root?.unmount());
  game = { enabled: false, hidden: false, player: null };
  expect(render().textContent).toContain("The game is off in this workspace");
});
