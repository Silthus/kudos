// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

/** Cosmetics on the web (#98): your look on Me, the Store's previews and the Super kudos celebration. */

let results: Record<string, unknown> = {};
const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => (args === "skip" ? undefined : results[getFunctionName(fn)]),
  useMutation: (fn: FunctionReference<"mutation">) => (mutations[getFunctionName(fn)] ??= vi.fn(async () => null)),
}));

const { FramedAvatar, ItemArt, LookCard, SuperKudosCelebration } = await import("./cosmetics");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  results = {};
  for (const k of Object.keys(mutations)) delete mutations[k];
});

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{node}</MemoryRouter>));
  return host;
}

const mine = {
  look: { frame: "frameSunrise", sticker: "stickerParty" },
  owned: ["frameSunrise", "frameMeadow", "stickerParty"],
  emoji: [
    { shortcode: ":taco:", name: "Kudos emoji", source: "workspace", suffix: null },
    { shortcode: ":taco-golden:", name: "Golden kudos emoji", source: "store", suffix: "golden" },
  ],
  superKudos: { shortcode: ":taco-super:", perMonth: 2, used: 1, left: 1, spotlight: false },
};
const profile = { name: "Ana", avatarUrl: null, level: 6, title: "Gardener", given: 42, look: { frame: "frameSunrise", sticker: "stickerParty" } };

test("your look: what you wear, the rest of what you own to switch to, your kudos emoji and Super kudos left", () => {
  results = { "cosmetics:mine": mine, "cosmetics:profile": profile };
  const host = render(<LookCard memberId={"m1" as never} today="2026-09-23" />);
  expect(host.textContent).toContain("Level 6");
  expect(host.textContent).toContain("Gardener");
  expect(host.textContent).toContain("42 given");
  expect(host.querySelector("[data-frame='frameSunrise']")).not.toBeNull();
  expect(host.querySelector("[data-sticker='stickerParty']")).not.toBeNull();
  const wearing = [...host.querySelectorAll("button[aria-pressed=true]")].map((b) => b.getAttribute("aria-label"));
  expect(wearing).toEqual(["Wear Sunrise frame", "Wear Party hoggie"]);
  expect(host.textContent).toContain(":taco-golden:");
  expect(host.textContent).toContain("1 of 2 Super kudos left this month");
  expect(host.textContent).toContain(":taco-super:");
});

test("wearing another frame, or taking one off", () => {
  results = { "cosmetics:mine": mine, "cosmetics:profile": profile };
  const host = render(<LookCard memberId={"m1" as never} today="2026-09-23" />);
  act(() => (host.querySelector("button[aria-label='Wear Meadow frame']") as HTMLButtonElement).click());
  expect(mutations["cosmetics:wear"]).toHaveBeenCalledWith({ slot: "frame", key: "frameMeadow" });
  act(() => (host.querySelector("button[aria-label='Take off your frame']") as HTMLButtonElement).click());
  expect(mutations["cosmetics:wear"]).toHaveBeenLastCalledWith({ slot: "frame", key: null });
});

test("nothing owned yet: the Store is where they come from", () => {
  results = { "cosmetics:mine": { ...mine, look: {}, owned: [], superKudos: null }, "cosmetics:profile": { ...profile, look: {} } };
  const host = render(<LookCard memberId={"m1" as never} today="2026-09-23" />);
  expect(host.textContent).toContain("Frames, banners and hoggie stickers are in the Store");
  expect(host.textContent).not.toContain("Super kudos left");
});

test("nothing while the game is off or hidden", () => {
  results = { "cosmetics:mine": null, "cosmetics:profile": profile };
  const host = render(<LookCard memberId={"m1" as never} today="2026-09-23" />);
  expect(host.textContent).toBe("");
});

test("a framed avatar wears its frame and sticker as art slots, with placeholders until the art loads", () => {
  const host = render(<FramedAvatar name="Ana" look={{ frame: "frameNightSky", sticker: "stickerReader" }} size={48} />);
  expect(host.querySelector("[data-art-slot='frame-night-sky']")).not.toBeNull();
  expect(host.querySelector("[data-art-slot='hoggie-reader']")).not.toBeNull();
  expect(host.querySelector("img")).toBeNull(); // nothing PostHog-drawn is committed: no art URL yet
});

test("an avatar without a frame keeps its own size, so unframed rows line up (review #10)", () => {
  const plain = render(<FramedAvatar name="Ben" size={32} />).firstElementChild as HTMLElement;
  expect([plain.style.width, plain.style.height]).toEqual(["32px", "32px"]);
});

test("the Store previews cosmetics and emoji variants, and nothing for other items", () => {
  expect(render(<ItemArt itemKey="bannerStarfield" />).querySelector("[data-art-slot='banner-starfield']")).not.toBeNull();
  expect(render(<ItemArt itemKey="emojiRainbow" />).querySelector("[data-art-slot='emoji-rainbow']")).not.toBeNull();
  expect(render(<ItemArt itemKey="spreeJoin" />).textContent).toBe("");
});

test("the Super kudos celebration: who chose you and why, until you close it", () => {
  results = { "superKudos:celebration": { id: "sk1", from: "Ana", avatarUrl: null, note: "for untangling the release pipeline", at: 0 } };
  render(<SuperKudosCelebration today="2026-09-23" />);
  const dialog = document.querySelector("[role=dialog]")!;
  expect(dialog.textContent).toContain("A Super kudos from Ana");
  expect(dialog.textContent).toContain("for untangling the release pipeline");
  act(() => (dialog.querySelector("button") as HTMLButtonElement).click());
  expect(mutations["superKudos:seen"]).toHaveBeenCalledWith({ id: "sk1" });
});

test("the celebration takes focus and Escape closes it (review #11)", () => {
  results = { "superKudos:celebration": { id: "sk2", from: "Ana", avatarUrl: null, note: "", at: 0 } };
  render(<SuperKudosCelebration today="2026-09-23" />);
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(mutations["superKudos:seen"]).toHaveBeenCalledWith({ id: "sk2" });
});
