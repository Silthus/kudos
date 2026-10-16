import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { Collection, CollectionRead, MyCollection } from "./collectionRead";
import { packFlipsForMs, packSlidesForMs } from "./book/packs/FoilPack";
import { bookFlipsForMs, landingPauseMs, tileSettlesForMs } from "./book/packs/PackLanding";
import { shellFixtures, type CrateOpenReply, type Drop, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const shopper: MemberProfile = { ...shellFixtures.memberWithTheInventory, coins: 120, bookSpread: true };

const shown = ["doctor", "wizard", "banana", "surfer"];

function light<T extends Collection>(collection: T): T {
  return { ...collection, hoggies: collection.hoggies.filter(({ hoggie }) => shown.includes(hoggie)), crests: undefined };
}

const twoPacks = light(collectionFixtures.withTheStore);

function dropOf(slug: string): Drop {
  const hoggie = twoPacks.hoggies.find((entry) => entry.hoggie === slug)!;
  return { hoggie: slug, name: hoggie.name, rarity: hoggie.rarity, art: hoggie.art, copy: hoggie.count + 1, isNew: hoggie.count === 0, crest: null };
}

const doctor = dropOf("doctor");

const wizard = dropOf("wizard");

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/book/collection");
});

afterEach(() => {
  vi.useRealTimers();
});

function main() {
  return screen.getByRole("main");
}

function crates() {
  return within(main()).getByRole("region", { name: "Crates" });
}

function stack() {
  return within(crates()).getByRole("group", { name: /^\d+ packs? waiting/ });
}

function packButtons() {
  return within(stack()).getAllByRole("button");
}

function dialog() {
  return screen.queryByRole("dialog");
}

function packInScene(crate: string) {
  return dialog()!.querySelector<HTMLElement>(`[data-pack="${crate}"] [data-phase]`)!;
}

function sceneButtons() {
  return within(dialog()!)
    .queryAllByRole("button")
    .filter((button) => !(button as HTMLButtonElement).disabled);
}

function announcement() {
  return screen.getByTestId("pack-announcement");
}

function tile(slug: string) {
  return main().querySelector<HTMLElement>(`[data-hoggie="${slug}"]`)!;
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

async function settle(ms: number) {
  advance(ms);
  await act(async () => {});
}

type Shown = { member?: MemberProfile; read?: CollectionRead; openCrate?: (crate: string) => Promise<CrateOpenReply> };

function showThePacks(answer: MyCollection = twoPacks, { member = shopper, read = fixedCollection(answer), openCrate = async () => ({ kind: "refused" }) }: Shown = {}) {
  const opening = vi.fn(openCrate);
  const view = renderApp(member, undefined, { openCrate: opening }, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, read);
  return { ...view, openCrate: opening };
}

function storeAnswering(answers: MyCollection[]): { read: CollectionRead; next: () => void } {
  let at = 0;
  return { read: (asking) => (asking ? answers[at] : undefined), next: () => (at += 1) };
}

function answersByCrate(drops: Record<string, Drop>) {
  return async (crate: string): Promise<CrateOpenReply> => ({ kind: "opened", drop: drops[crate]! });
}

async function fanOutAndOpen(at: number, shown: Shown = {}) {
  const view = showThePacks(twoPacks, { openCrate: answersByCrate({ "bought:1": doctor, "bought:2": wizard }), ...shown });
  vi.useFakeTimers();
  fireEvent.click(packButtons()[0]!);
  fireEvent.click(packButtons()[at]!);
  await act(async () => {});
  return view;
}

async function revealTheTappedPack() {
  await settle(packSlidesForMs);
  await settle(packFlipsForMs);
}

describe("#586: the Book's bought crates sit below it as a foil-pack stack while book-spread is on", () => {
  it("keeps today's Waiting to open list while the flag is off", () => {
    showThePacks(twoPacks, { member: { ...shopper, bookSpread: undefined } });

    expect(within(crates()).getByRole("list", { name: "Waiting to open" })).toBeInTheDocument();
    expect(within(crates()).queryByRole("group")).toBeNull();
  });

  it("stacks the waiting packs with their count, every layer fanning the stack out, and keeps Buy a crate", () => {
    showThePacks();

    expect(within(crates()).queryByRole("list", { name: "Waiting to open" })).toBeNull();
    expect(stack()).toHaveAccessibleName("2 packs waiting");
    expect(stack()).not.toHaveAttribute("data-spread");
    expect(packButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Fan out the 2 packs", "Fan out the 2 packs"]);
    expect(crates()).toHaveTextContent("2 packs waiting · tap the stack to fan them out");
    expect(within(crates()).getByRole("button", { name: "Buy a crate · 50 coins" })).toHaveClass("quill-button--variant-outline");
  });

  it("fans out on a tap, then names each pack to open, and sends openCrate once for the tapped pack however often it's pressed", async () => {
    let settleAnswer!: (answer: CrateOpenReply) => void;
    const pending = new Promise<CrateOpenReply>((resolve) => (settleAnswer = resolve));
    const { user, openCrate } = showThePacks(twoPacks, { openCrate: () => pending });

    await user.click(packButtons()[0]!);

    expect(stack()).toHaveAttribute("data-spread");
    expect(packButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Open pack 1", "Open pack 2"]);
    expect(crates()).toHaveTextContent("Pick a pack to open it.");
    expect(openCrate).not.toHaveBeenCalled();
    await user.click(packButtons()[1]!);
    expect(openCrate).toHaveBeenCalledExactlyOnceWith("bought:2");
    expect(dialog()).toHaveAccessibleName("Opening your packs");
    fireEvent.click(packInScene("bought:2").querySelector("button")!);
    expect(openCrate).toHaveBeenCalledTimes(1);
    await act(async () => settleAnswer({ kind: "opened", drop: wizard }));
    expect(packInScene("bought:2")).toHaveAttribute("data-phase", "sliding");
  });

  it("carries each pack's crate target so a ?crate= deep link lands on it", () => {
    showThePacks();
    expect(stack().querySelectorAll("[data-crate-target]").length).toBe(2);
    expect(stack().querySelector('[data-crate-target="bought:2"] button')).toHaveAccessibleName("Fan out the 2 packs");
  });
});

describe("#586: tapping a pack opens the scene over a dark scrim", () => {
  it("tears the tapped pack while the open is out, then slides and flips its card to the hoggie with the ribbon and name, the other pack sealed beside it with no other buttons", async () => {
    let settleAnswer!: (answer: CrateOpenReply) => void;
    const pending = new Promise<CrateOpenReply>((resolve) => (settleAnswer = resolve));
    await fanOutAndOpen(0, { openCrate: () => pending });

    expect(dialog()).toHaveFocus();
    expect(dialog()).toHaveTextContent("Packs · 0 of 2 opened");
    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "tearing");
    expect(packInScene("bought:2")).toHaveAttribute("data-phase", "sealed");
    expect(sceneButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Open pack 2"]);
    await act(async () => settleAnswer({ kind: "opened", drop: doctor }));
    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "sliding");
    advance(packSlidesForMs);
    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "flipping");
    advance(packFlipsForMs);

    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "reveal");
    expect(packInScene("bought:1")).toHaveAttribute("data-rarity", doctor.rarity);
    expect(dialog()).toHaveTextContent("Packs · 1 of 2 opened");
    expect(within(dialog()!).getByTestId("pack-ribbon")).toHaveTextContent(`${doctor.rarity.charAt(0).toUpperCase()}${doctor.rarity.slice(1)} find`);
    expect(within(dialog()!).getByRole("heading", { level: 2, name: doctor.name })).toBeVisible();
    expect(sceneButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Open pack 2"]);
    expect(dialog()).not.toHaveTextContent(/Put them in the book|XP|coin|1 in \d+|new page/);
    expect(announcement()).toHaveTextContent(`You opened pack 1. You found an ${doctor.rarity} ${doctor.name}.`);
  });

  it("re-seals the pack with That couldn't be opened after refused, keeps the scene open, and sends again on the next tap", async () => {
    const { openCrate } = await fanOutAndOpen(0, { openCrate: async () => ({ kind: "refused" }) });

    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "sealed");
    expect(packInScene("bought:1")).toHaveTextContent("That couldn't be opened.");
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(packInScene("bought:1").querySelector("button")!);
    expect(openCrate).toHaveBeenCalledTimes(2);
  });

  it("says Couldn't reach HedgeHug after a failed send", async () => {
    await fanOutAndOpen(0, { openCrate: async () => Promise.reject(new Error("connection closed")) });

    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "sealed");
    expect(packInScene("bought:1")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(announcement()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
  });

  it("opens the next pack from the scene on tap, keeps the first open in the row, and offers Put them in the book once every pack is open", async () => {
    const { openCrate } = await fanOutAndOpen(0);
    await revealTheTappedPack();

    fireEvent.click(packInScene("bought:2").querySelector("button")!);
    await act(async () => {});
    expect(openCrate.mock.calls).toEqual([["bought:1"], ["bought:2"]]);
    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "reveal");
    expect(sceneButtons()).toEqual([]);
    await revealTheTappedPack();

    expect(dialog()).toHaveTextContent("Packs · 2 of 2 opened");
    expect(within(dialog()!).getByRole("heading", { level: 2, name: wizard.name })).toBeVisible();
    expect(within(dialog()!).getByTestId("pack-ribbon")).toHaveTextContent("✦ Legendary find ✦");
    expect(within(dialog()!).getByRole("button", { name: "Put them in the book" })).toHaveFocus();
  });

  it("reveals at once under reduced motion", async () => {
    preferReducedMotion();
    await fanOutAndOpen(0);

    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "reveal");
    expect(within(dialog()!).getByRole("heading", { level: 2, name: doctor.name })).toBeVisible();
  });

  it("closes on Escape with nothing opened, focusing the stack, and leaves both packs waiting", async () => {
    let settleAnswer!: (answer: CrateOpenReply) => void;
    const pending = new Promise<CrateOpenReply>((resolve) => (settleAnswer = resolve));
    await fanOutAndOpen(0, { openCrate: () => pending });

    fireEvent.keyDown(dialog()!, { key: "Escape" });

    expect(dialog()).toBeNull();
    expect(packButtons()).toHaveLength(2);
    expect(packButtons()[0]).toHaveFocus();
    await act(async () => settleAnswer({ kind: "opened", drop: doctor }));
    expect(dialog()).toBeNull();
    expect(packButtons()).toHaveLength(2);
    expect(window.location.hash).toBe("");
    expect(announcement()).toHaveTextContent("");
  });

  it("keeps an opened pack in the row when the read drops its crate, and still offers Put them in the book once the rest are open", async () => {
    const store = storeAnswering([twoPacks, { ...twoPacks, bought: ["bought:2"] }]);
    const { showVisitor } = await fanOutAndOpen(0, { read: store.read });
    await revealTheTappedPack();

    store.next();
    showVisitor({ ...shopper });

    expect(packInScene("bought:1")).toHaveAttribute("data-phase", "reveal");
    expect(dialog()).toHaveTextContent("Packs · 1 of 2 opened");
    fireEvent.click(packInScene("bought:2").querySelector("button")!);
    await act(async () => {});
    await revealTheTappedPack();
    expect(within(dialog()!).getByRole("button", { name: "Put them in the book" })).toBeInTheDocument();
  });

  it("keeps the command palette shut behind the scene", async () => {
    await fanOutAndOpen(0);

    fireEvent.keyDown(dialog()!, { key: "k", ctrlKey: true });

    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    expect(dialog()).toHaveAccessibleName("Opening your packs");
    expect(document.querySelector(".hud-root")).toHaveAttribute("inert");
  });
});

describe("#586: Put them in the book lands each hoggie on its tile", () => {
  it("flips the book to the rarity, pops the tile, announces the landing, takes the packs off the stack and returns focus to the page title", async () => {
    await fanOutAndOpen(0);
    await revealTheTappedPack();
    fireEvent.click(packInScene("bought:2").querySelector("button")!);
    await act(async () => {});
    await revealTheTappedPack();

    fireEvent.click(within(dialog()!).getByRole("button", { name: "Put them in the book" }));

    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe(`#hoggies/${doctor.rarity}`);
    await settle(bookFlipsForMs);
    await settle(tileSettlesForMs);
    expect(tile("doctor")).toHaveAttribute("data-landed");
    expect(main().querySelector('[data-spread="hoggies"] [data-hoggie="wizard"]')).toBeNull();
    await settle(landingPauseMs);
    expect(window.location.hash).toBe(`#hoggies/${wizard.rarity}`);
    await settle(bookFlipsForMs);
    await settle(tileSettlesForMs);
    expect(tile("wizard")).toHaveAttribute("data-landed");
    await settle(landingPauseMs);

    expect(announcement()).toHaveTextContent(`${doctor.name} and ${wizard.name} are in your book.`);
    expect(within(crates()).queryByRole("group")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("lands what's open on Escape and leaves the sealed pack on the stack, focused", async () => {
    await fanOutAndOpen(0);
    await revealTheTappedPack();

    fireEvent.keyDown(dialog()!, { key: "Escape" });

    expect(dialog()).toBeNull();
    expect(stack()).toHaveAccessibleName("1 pack waiting");
    await settle(bookFlipsForMs);
    await settle(tileSettlesForMs);
    expect(tile("doctor")).toHaveAttribute("data-landed");
    await settle(landingPauseMs);
    expect(stack()).toHaveAccessibleName("1 pack waiting");
    expect(packButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Fan out the 1 pack"]);
    expect(packButtons()[0]).toHaveFocus();
  });

  it("lands at once under reduced motion", async () => {
    preferReducedMotion();
    await fanOutAndOpen(0);

    fireEvent.keyDown(dialog()!, { key: "Escape" });
    await settle(bookFlipsForMs);
    await settle(tileSettlesForMs);

    expect(tile("doctor")).toHaveAttribute("data-landed");
    await settle(landingPauseMs);
    expect(announcement()).toHaveTextContent(`${doctor.name} is in your book.`);
  });
});

describe("#586: the stack and the scene are accessible", () => {
  const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  async function violations() {
    const results = await axe.run(document.body, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
    return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
  }

  it.each([false, true])("fans out and opens from the keyboard, traps Tab in the scene, and passes axe at each step (dark: %s)", async (dark) => {
    fakeSystemTheme(dark);
    const { user } = showThePacks(twoPacks, { openCrate: answersByCrate({ "bought:1": doctor, "bought:2": wizard }) });
    expect(await violations()).toEqual([]);
    act(() => packButtons()[0]!.focus());

    await user.keyboard("{Enter}");
    expect(stack()).toHaveAttribute("data-spread");
    expect(packButtons()[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(dialog()).toHaveAccessibleName("Opening your packs");
    expect(dialog()).toHaveFocus();
    expect(await violations()).toEqual([]);
    await user.tab();
    expect(packInScene("bought:2").querySelector("button")).toHaveFocus();
    await user.tab();
    expect(packInScene("bought:2").querySelector("button")).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(dialog()).toBeNull();
    expect(await violations()).toEqual([]);
  }, 60_000);
});
