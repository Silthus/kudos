// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";

let mine: unknown;
const setHidden = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "game:mine" ? mine : undefined),
  useMutation: () => setHidden,
}));

const { GameCard, Locked } = await import("./game");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  setHidden.mockClear();
});

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

const level2 = { level: 2, title: "Seedling", xp: 40, floor: 30, next: 75, toNext: 35, fraction: 10 / 45 };

test("a player sees their level, title and the next-level bar, and only the next areas ahead, locked", () => {
  mine = { enabled: true, hidden: false, player: level2 };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.textContent).toContain("Level 2");
  expect(host.textContent).toContain("Seedling");
  expect(host.textContent).toContain("35 XP to level 3");
  const bar = host.querySelector("[role=progressbar]")!;
  expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemax")]).toEqual(["10", "45"]);
  const locked = [...host.querySelectorAll("[data-locked]")].map((el) => el.getAttribute("aria-label"));
  expect(locked).toEqual(["Hog coins, opens at level 3", "Your garden, opens at level 3"]);
  expect(host.textContent).not.toContain("Store");
});

test("at the top level there is no next level to show", () => {
  mine = { enabled: true, hidden: false, player: { level: 25, title: "Elder hog", xp: 15_000, floor: 14_850, next: null, toNext: null, fraction: 1 } };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.textContent).toContain("Top level");
  expect(host.querySelectorAll("[data-locked]")).toHaveLength(0);
});

test("before their first kudos a member is invited to give, not shown a level", () => {
  mine = { enabled: true, hidden: false, player: null };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.textContent).toContain("You can give kudos too");
  expect(host.querySelector("[role=progressbar]")).toBeNull();
});

test("hiding the game leaves only the way back", () => {
  mine = { enabled: true, hidden: false, player: level2 };
  let host = render(<GameCard glyph="🌮" />);
  const hide = [...host.querySelectorAll("button")].find((b) => b.textContent === "Hide the game")!;
  act(() => hide.click());
  expect(setHidden).toHaveBeenCalledWith({ hidden: true });

  act(() => root?.unmount());
  mine = { enabled: true, hidden: true, player: level2 };
  host = render(<GameCard glyph="🌮" />);
  expect(host.textContent).not.toContain("Level 2");
  const show = [...host.querySelectorAll("button")].find((b) => b.textContent === "Show the game")!;
  act(() => show.click());
  expect(setHidden).toHaveBeenCalledWith({ hidden: false });
});

test("with the game off there is nothing to show", () => {
  mine = { enabled: false, hidden: false, player: null };
  expect(render(<GameCard glyph="🌮" />).textContent).toBe("");
});

test("the locked primitive: a lock, the name, the level it opens at and one line on how to get there", () => {
  const host = render(<Locked title="Skill tree" level={2} how="Every level-up brings a skill point." />);
  const el = host.querySelector("[data-locked]")!;
  expect(el.getAttribute("aria-label")).toBe("Skill tree, opens at level 2");
  expect(el.textContent).toContain("Level 2");
  expect(el.textContent).toContain("Every level-up brings a skill point.");
  expect(el.querySelector("svg")).not.toBeNull();
});
