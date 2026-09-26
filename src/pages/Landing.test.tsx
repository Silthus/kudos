// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, parchmentTextOnDusk, widensSideways } from "@/testing/layout";
import { copyProblems } from "@/testing/windowPage";
import { tileOnCanvas } from "@/world/paint";
import { HOG_FEET, HOG_SIZE } from "@/world/Hog";

/**
 * The signed-out world (#133): the garden seen from above at dusk, a hedgehog at the gate, the name
 * on a wooden sign and the two ways in.
 */

let setup: { demoEnabled: boolean } = { demoEnabled: true };
vi.mock("convex/react", () => ({ useQuery: () => setup }));
const signIn = vi.fn(async (_provider: string, _opts?: unknown) => ({ signingIn: true }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn, signOut: vi.fn() }) }));
// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("@/world/atlas", async (real) => ({ ...(await real<typeof import("@/world/atlas")>()), loadAtlas: () => new Promise(() => {}) }));

const { Landing } = await import("./Landing");
const { NotInstalled } = await import("./NotInstalled");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

// A canvas that records what's painted on the world.
let painted: { width: number; height: number }[] = [];
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  if (!this.hasAttribute("data-landing-world")) return null;
  return {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (img: { width: number; height: number }) => painted.push({ width: img.width, height: img.height }),
  };
} as never;

let root: Root | undefined;
beforeEach(() => {
  setup = { demoEnabled: true };
  signIn.mockClear();
  painted = [];
});
afterEach(() => act(() => root?.unmount()));

function render(page: ReactNode, url = "/") {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter initialEntries={[url]}>{page}</MemoryRouter>));
  return host;
}
const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);

test("the landing page names Kudos on a wooden sign, says what it is in one sentence, and offers the two ways in", () => {
  const host = render(<Landing />);
  const sign = host.querySelector("[data-landing-sign]")!;
  expect(sign.querySelector("h1")?.textContent).toBe("Kudos");
  expect(sign.querySelector("h1")?.className).toContain("font-display");
  expect(host.querySelector("[data-landing-sentence]")?.textContent).toMatch(/^[^.]+\.$/);
  expect(button(host, "Sign in with Slack")?.className).toContain("pixel-btn");
  expect(button(host, "Explore the live demo")?.className).toContain("pixel-btn");
});

test("the world lies below at dusk, painted from the map, with a hedgehog standing at the garden gate", () => {
  const host = render(<Landing />);
  const world = host.querySelector("canvas[data-landing-world]")!;
  expect(world.getAttribute("aria-hidden")).toBe("true");
  expect(painted).toEqual([{ width: Number(world.getAttribute("width")), height: Number(world.getAttribute("height")) }]);
  const hog = host.querySelector<HTMLElement>("[data-landing-hog]")!;
  const gate = tileOnCanvas({ x: 20, y: 18 });
  // The hedgehog's feet on the gate tile, at the world's scale.
  expect(hog.style.left).toBe(`calc(${gate.x}px * var(--s) - ${HOG_SIZE / 2}px)`);
  expect(hog.style.top).toBe(`calc(${gate.y}px * var(--s) - ${HOG_FEET}px)`);
  expect(hog.querySelector("canvas")).not.toBeNull();
});

test("signing in with Slack comes back to the page asked for, workspace link and all", async () => {
  const host = render(<Landing />, "/quests?ws=T123#board");
  await act(async () => button(host, "Sign in with Slack")!.click());
  expect(signIn).toHaveBeenCalledWith("slack", { redirectTo: "/quests?ws=T123#board" });
});

test("the live demo signs in as the demo visitor, and says so when it can't", async () => {
  const host = render(<Landing />);
  signIn.mockResolvedValueOnce({ signingIn: false });
  await act(async () => button(host, "Explore the live demo")!.click());
  expect(signIn).toHaveBeenCalledWith("demo");
  expect(host.querySelector("[role=alert]")?.textContent).toContain("The demo couldn't be opened");
});

test("without the demo the page offers only Slack", () => {
  setup = { demoEnabled: false };
  const host = render(<Landing />);
  expect(button(host, "Explore the live demo")).toBeUndefined();
  expect(button(host, "Sign in with Slack")).toBeDefined();
});

test("three short signs say what you do, then the Slack mock and the drop rates", () => {
  const host = render(<Landing />);
  const signs = [...host.querySelectorAll("[data-landing-feature] h2")].map((h) => h.textContent);
  expect(signs).toEqual(["Give a seed", "Grow a garden", "Discover messages"]);
  // Seeds of appreciation (#168): the first sign shows how, with the seedling a new install gives with.
  const give = host.querySelector("[data-landing-feature] p")!;
  expect(give.textContent).toBe("Thank a teammate in Slack: @name 🌱 and a few words on why. Everyone has a few to give each day, so each one counts.");
  expect(give.querySelector("[data-user-text]")?.textContent).toBe("🌱");
  expect(host.querySelector("[data-slack-mock]")!.textContent).not.toContain("🌮");
  expect(host.querySelector("[data-slack-mock]")).not.toBeNull();
  expect(host.textContent).toContain("Every reply is a roll of the dice");
  expect(host.querySelectorAll("[data-drop-rate]")).toHaveLength(5);
});

test("an install that finished or failed is reported, in plain words", () => {
  const done = render(<Landing />, "/?installed=Lumen%20Labs");
  expect(done.querySelector("[role=status]")?.textContent).toContain("Kudos is installed in Lumen Labs");
  act(() => root?.unmount());
  const failed = render(<Landing />, "/?install_error=state_mismatch");
  expect(failed.querySelector("[role=status]")?.textContent).toContain("Installation didn't complete");
  // review: the way to start again is right there, not a button that isn't on the page.
  expect(failed.querySelector("[role=status] a[href$='/slack/install']")?.textContent).toBe("Add Kudos to Slack again");
});

test("review: the page's content is its main landmark", () => {
  const host = render(<Landing />);
  expect(host.querySelector("main [data-landing-sign]")).not.toBeNull();
});

test("the copy has no middle dots, arrows or emoji outside the Slack mock", () => {
  const host = render(<Landing />, "/?installed=Lumen%20Labs");
  expect(copyProblems(host)).toEqual([]);
});

test("on a phone nothing on the landing page widens it (class guards; the widths are checked in the browser), and parchment text stays on parchment", () => {
  const host = render(<Landing />);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
});

test("the not-installed page is a parchment page with the way forward", () => {
  const host = render(<NotInstalled name="Maximiliane Featherstonehaugh" />);
  expect(host.textContent).toContain("Almost there, Maximiliane!");
  expect(host.querySelector(".pixel-frame")).not.toBeNull();
  expect(host.querySelector("a[href$='/slack/install']")?.textContent).toContain("Add Kudos to Slack");
  expect(button(host, "Sign out")).toBeDefined();
  expect(copyProblems(host)).toEqual([]);
});

test("on a phone nothing on the not-installed page widens it", () => {
  const host = render(<NotInstalled name="Maximiliane Featherstonehaugh" />);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
});
