// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

let mine: unknown;
let tree: unknown;
let hints: unknown;
const setHidden = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(fn);
    return name === "game:mine" ? mine : name === "skills:mine" ? tree : name === "skills:hints" ? hints : undefined;
  },
  useMutation: () => setHidden,
}));

const { Earnings, GameCard, GameSwitch, LevelUpHoggie, Locked, ScoutHints } = await import("./game");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  setHidden.mockClear();
  tree = undefined;
  hints = undefined;
});

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{node}</MemoryRouter>));
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

test("the cabin's level number is set in Nunito with tabular figures, the word in Pixelify: Pixelify's 5 reads as an S (#171 review)", () => {
  mine = { enabled: true, hidden: false, player: { ...level2, level: 25, title: "Elder hog", next: null, toNext: null } };
  const host = render(<GameCard glyph="🌮" />);
  const number = [...host.querySelectorAll("*")].find((el) => el.children.length === 0 && el.textContent === "25")!;
  expect(number.closest(".font-display, .font-sans")?.classList).toContain("font-sans");
  expect(number.closest(".tabular")).not.toBeNull();
  expect(number.parentElement?.closest(".font-display")?.textContent).toBe("Level 25");
});

const level3 = { level: 3, title: "Sprout", xp: 87, floor: 75, next: 175, toNext: 88, fraction: 12 / 100 };

test("at level 3 the wallet appears with everything collected so far, and the next areas stay locked", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 28, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromLevels: 20, spent: 0, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  const wallet = host.querySelector("[data-wallet]")!;
  expect(wallet.getAttribute("aria-label")).toBe("Hog coins: 28");
  expect(wallet.textContent).toContain("28");
  expect(wallet.textContent).toContain("8 from thoughtful kudos and 20 from level-ups.");
  const locked = [...host.querySelectorAll("[data-locked]")].map((el) => el.getAttribute("aria-label"));
  expect(locked).toEqual(["Store, opens at level 5", "Quests, opens at level 5"]);
});

test("the wallet shows the Hog coin: Max on a gold coin, and the plain gold coin if Max can't load (#101)", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 28, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromLevels: 20, spent: 0, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  const coin = host.querySelector("[data-wallet] [data-hog-coin]")!;
  const max = coin.querySelector("[data-art-slot='coin-max'] img")!;
  expect(max.getAttribute("src")).toContain("/ai_max_e80de99727.png");
  act(() => void max.dispatchEvent(new Event("error")));
  expect(coin.querySelector("img")).toBeNull();
  expect(coin.querySelector("[data-art-slot='coin-max'] [data-coin-face]")).not.toBeNull(); // the coin's own face
  expect(coin.textContent).toBe(""); // never reads into the amount
});

test("the giver's earnings reply on the web leads with the Hog coin (#101)", () => {
  const host = render(<Earnings text="+10 XP · +2 Hog coins" />);
  expect(host.textContent).toBe("+10 XP · +2 Hog coins");
  expect(host.querySelector("[data-hog-coin]")).not.toBeNull();
});

test("before the wallet opens the reply earns no coins, so it shows no Hog coin (review #2)", () => {
  const host = render(<Earnings text="+10 XP · new connection +10" />);
  expect(host.textContent).toBe("+10 XP · new connection +10");
  expect(host.querySelector("[data-hog-coin]")).toBeNull();
});

test("a level-up DM on the web brings the level-up hoggie; other gains don't (#101)", () => {
  expect(render(<LevelUpHoggie label="Level up" />).querySelector("[data-art-slot='hoggie-level-up'] img")?.getAttribute("src")).toContain("/hoggies/png/level-up.png");
  expect(render(<LevelUpHoggie label="New discovery" />).innerHTML).toBe("");
  expect(render(<LevelUpHoggie />).innerHTML).toBe("");
});

test("an older level-up DM without gains still brings the hoggie (review #4)", () => {
  expect(render(<LevelUpHoggie category="level_up" />).querySelector("[data-art-slot='hoggie-level-up']")).not.toBeNull();
  expect(render(<LevelUpHoggie category="giver_success" />).innerHTML).toBe("");
});

test("fruit picked in the garden is its own line in the wallet, and the garden is a click away (#95)", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 31, fromKudos: 8, fromFruit: 3, fromQuests: 0, fromLevels: 20, spent: 0, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.querySelector("[data-wallet]")!.textContent).toContain("8 from thoughtful kudos, 3 from fruit and 20 from level-ups.");
  expect(host.querySelector('a[href="/garden"]')?.textContent).toContain("Your garden");
});

test("coins waiting at the tree are told apart from the balance, with the way to the stone (#157)", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 28, waiting: 12, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromLevels: 20, spent: 0, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  const wallet = host.querySelector("[data-wallet]")!;
  expect(wallet.textContent).toContain("12 more wait at the tree.");
  expect(wallet.querySelector('a[href="/offering"]')?.textContent).toBe("Offer them at the stone");
});

test("coins from kudos sprees are their own line in the wallet (#94)", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 34, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromSprees: 6, fromLevels: 20, spent: 0, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.querySelector("[data-wallet]")!.textContent).toContain("8 from thoughtful kudos, 6 from kudos sprees and 20 from level-ups.");
});

test("below level 3 there is no wallet, only its locked tile", () => {
  mine = { enabled: true, hidden: false, player: level2, wallet: null };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.querySelector("[data-wallet]")).toBeNull();
  expect(host.querySelector("[data-locked][aria-label^='Hog coins']")).not.toBeNull();
});

test("a balance a revoke took below zero says spending waits", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: -2, fromKudos: 8, fromFruit: 0, fromQuests: 0, fromLevels: 20, spent: 30, adjusted: 0 } };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.querySelector("[data-wallet]")!.textContent).toContain("Spending waits until it's above zero again");
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
  expect(host.textContent).toContain("You can give seeds of appreciation too");
  expect(host.textContent).toContain("Give a seed in Slack: @name 🌮 and a few words on why.");
  expect(host.querySelector("[data-user-text]")?.textContent).toBe("🌮");
  expect(host.querySelector("[role=progressbar]")).toBeNull();
});

test("spent coins and admin adjustments are their own sentences", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: { balance: 5, fromKudos: 8, fromFruit: 0, fromQuests: 2, fromLevels: 20, spent: 30, adjusted: 5 } };
  const host = render(<GameCard glyph="🌮" />);
  expect(host.querySelector("[data-wallet]")!.textContent).toContain("8 from thoughtful kudos, 2 from quests and 20 from level-ups. You spent 30. Admins added 5.");
});

test("hiding the game is a switch; hidden, the card only says so and where the switch is", () => {
  mine = { enabled: true, hidden: false, player: level2 };
  let host = render(<GameSwitch />);
  const toggle = host.querySelector<HTMLButtonElement>("[role=switch]")!;
  expect(toggle.getAttribute("aria-label")).toBe("Show the game");
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  act(() => toggle.click());
  expect(setHidden).toHaveBeenCalledWith({ hidden: true });
  // The card itself has no hide button any more: the switch is by the cabin door.
  act(() => root?.unmount());
  host = render(<GameCard glyph="🌮" />);
  expect([...host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Hide the game");

  act(() => root?.unmount());
  mine = { enabled: true, hidden: true, player: level2 };
  host = render(<GameCard glyph="🌮" />);
  expect(host.textContent).not.toContain("Level 2");
  expect(host.textContent).toContain("Your kudos still earn XP and Hog coins.");
  act(() => root?.unmount());
  host = render(<GameSwitch />);
  const off = host.querySelector<HTMLButtonElement>("[role=switch]")!;
  expect(off.getAttribute("aria-checked")).toBe("false");
  act(() => off.click());
  expect(setHidden).toHaveBeenCalledWith({ hidden: false });
});

test("with the game off there is no switch either", () => {
  mine = { enabled: false, hidden: false, player: null };
  expect(render(<GameSwitch />).textContent).toBe("");
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

test("a player's card links to their skill tree with the points they have to spend", () => {
  mine = { enabled: true, hidden: false, player: level3, wallet: null };
  tree = { level: 3, skills: { lookout: 1 }, resets: 0, resetCost: 50, balance: 28 };
  const host = render(<GameCard glyph="🌮" />);
  const link = host.querySelector<HTMLAnchorElement>("a[href='/skills']")!;
  expect(link.textContent).toContain("Skill tree");
  expect(link.textContent).toContain("1 skill point to spend");
});

test("Lookout lists teammates you haven't thanked in a while, privately; Wide net adds some you never have", () => {
  hints = {
    quiet: [{ memberId: "m2", name: "Ben Ortiz", avatarUrl: null, lastDay: "2026-07-01" }],
    never: [{ memberId: "m3", name: "Cleo Park", avatarUrl: null, lastDay: null }],
  };
  const host = render(<ScoutHints today="2026-09-23" />);
  expect(host.textContent).toContain("Only you see this");
  expect(host.textContent).toContain("Ben Ortiz");
  expect(host.textContent).toContain("last thanked 84 days ago");
  expect(host.textContent).toContain("Cleo Park");
  expect(host.textContent).toContain("never thanked yet");
});

test("without Lookout there are no hints", () => {
  hints = null;
  expect(render(<ScoutHints today="2026-09-23" />).textContent).toBe("");
});
