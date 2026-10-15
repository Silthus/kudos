import { cleanup, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { CollectionRead, MyCollection } from "./collectionRead";
import { markSeen } from "./crates/seen";
import { shellFixtures, type MemberProfile, type MyBook } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const theCollection = collectionFixtures.collection;

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/book/collection");
});

function main() {
  return screen.getByRole("main");
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function showCollection(answer: MyCollection, { member = shellFixtures.memberWithTheBookOpened, book = bookFixtures.everyLadder as MyBook, read = fixedCollection(answer) }: { member?: MemberProfile; book?: MyBook; read?: CollectionRead } = {}) {
  return renderApp(member, undefined, undefined, undefined, fixedBook(book), undefined, undefined, undefined, undefined, undefined, undefined, read);
}

function raritySection(name: string) {
  return within(main()).getByRole("region", { name });
}

function tilesIn(section: HTMLElement) {
  return [...section.querySelectorAll<HTMLElement>("[data-hoggie]")];
}

function tile(hoggie: string) {
  const found = main().querySelector<HTMLElement>(`[data-hoggie="${hoggie}"]`);
  if (found === null) throw new Error(`No tile for ${hoggie}`);
  return found;
}

describe("#467 CL15: /book/collection answers like the Book", () => {
  it("is the not-found page while getCollection answers not-found", () => {
    showCollection(collectionFixtures.notFound);
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("shows the locked page while getCollection answers locked", () => {
    showCollection(collectionFixtures.locked, { member: shellFixtures.memberWaitingForTheBook, book: bookFixtures.locked });
    expect(pageTitle()).toHaveTextContent("Unlocks at level 4");
  });

  it("shows the Book's crate in place with a primary Open while getCollection answers ready", () => {
    showCollection(collectionFixtures.ready, { member: shellFixtures.memberWithTheBookReady, book: bookFixtures.ready });
    const crate = within(main()).getByRole("heading", { level: 1, name: "Book is ready" }).closest("section")!;
    expect(within(crate).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-primary");
  });

  it("follows a denial to its page", () => {
    showCollection({ kind: "signed-out" });
    expect(within(main()).getByRole("button", { name: /Sign in with Slack/ })).toBeInTheDocument();
  });

  it("marks the page busy while getCollection loads", () => {
    showCollection(theCollection, { read: () => undefined });
    expect(main()).toHaveAttribute("aria-busy", "true");
  });

  it.each([
    ["/book", true],
    ["/book?page=giving", true],
    ["/book/earned", true],
    ["/book/collection", true],
    ["/", true],
    ["/quests", false],
  ])("asks getCollection on every Book page and on the home of a member whose Book is open: %s → %s", (path, asked) => {
    const read = vi.fn<CollectionRead>(() => undefined);
    window.history.replaceState(null, "", path);
    showCollection(theCollection, { read });
    expect(read.mock.calls.some(([asking]) => asking)).toBe(asked);
  });

  it("asks nothing on the home while the Book is locked or ready", () => {
    const read = vi.fn<CollectionRead>(() => undefined);
    window.history.replaceState(null, "", "/");
    showCollection(theCollection, { member: shellFixtures.memberWaitingForTheBook, read });
    expect(read).not.toHaveBeenCalledWith(true);
    cleanup();
    showCollection(theCollection, { member: shellFixtures.memberWithTheBookReady, read });
    expect(read).not.toHaveBeenCalledWith(true);
  });
});

describe("#467: the Collection page is a collector's book of every hoggie", () => {
  it("lives at /book/collection with the tab HedgeHug · Book · Collection, the label Book, the title Collection and its one line", () => {
    showCollection(theCollection);
    expect(document.title).toBe("HedgeHug · Book · Collection");
    expect(pageTitle()).toHaveTextContent("Collection");
    expect(within(main()).getByText("Book", { selector: ".hud-label" })).toBeInTheDocument();
    expect(main()).toHaveTextContent("Every crate you open drops one hoggie. Find all 151.");
  });

  it("leads with how many are found of the total, as a neutral progressbar", () => {
    showCollection(theCollection);
    const bar = within(main()).getByRole("progressbar", { name: "41 of 151 hoggies found" });
    expect(bar).toHaveAttribute("aria-valuenow", "41");
    expect(bar).toHaveAttribute("aria-valuemax", "151");
    expect(within(main()).getByRole("heading", { level: 2, name: "41 of 151 hoggies found" })).toHaveClass("hud-display");
  });

  it("holds one section per rarity, rarest first, named by its coloured square and word with its chance and its count", () => {
    showCollection(theCollection);
    const sections = within(main())
      .getAllByRole("region")
      .filter((region) => region.hasAttribute("data-rarity"));
    expect(sections.map((section) => section.getAttribute("data-rarity"))).toEqual(["legendary", "epic", "rare", "uncommon", "common"]);
    expect(raritySection("🟧 Legendary")).toHaveTextContent("2% chance");
    expect(raritySection("🟧 Legendary")).toHaveTextContent("1 of 6 found");
    expect(raritySection("🟪 Epic")).toHaveTextContent("6% chance");
    expect(raritySection("🟪 Epic")).toHaveTextContent("2 of 15 found");
    expect(raritySection("🟦 Rare")).toHaveTextContent("14% chance");
    expect(raritySection("🟩 Uncommon")).toHaveTextContent("28% chance");
    expect(raritySection("⬜ Common")).toHaveTextContent("50% chance");
    expect(raritySection("⬜ Common")).toHaveTextContent("24 of 60 found");
  });

  it("shows all 151 hoggies, each in its rarity's section in the answer's order", () => {
    showCollection(theCollection);
    expect(tilesIn(main())).toHaveLength(151);
    const expected = (rarity: string) => theCollection.hoggies.filter((hoggie) => hoggie.rarity === rarity).map(({ hoggie }) => hoggie);
    expect(tilesIn(raritySection("🟧 Legendary")).map((tile) => tile.dataset.hoggie)).toEqual(expected("legendary"));
    expect(tilesIn(raritySection("⬜ Common")).map((tile) => tile.dataset.hoggie)).toEqual(expected("common"));
  });

  it("draws a found hoggie in full art on its rarity's colour, with its name and ×{count} past the first copy", () => {
    showCollection(theCollection);
    const coffeeCup = tile("coffee-cup");
    expect(coffeeCup).toHaveAttribute("data-held", "found");
    expect(coffeeCup).toHaveAttribute("data-rarity", "common");
    expect(coffeeCup.querySelector("svg")).not.toBeNull();
    expect(coffeeCup.querySelector(".hog-silhouette")).toBeNull();
    expect(within(coffeeCup).getByText("Coffee Cup")).toBeInTheDocument();
    expect(within(coffeeCup).getByText("×4")).toBeInTheDocument();
    expect(within(tile("ball")).queryByText(/^×/)).not.toBeInTheDocument();
  });

  it("draws a missing hoggie as a silhouette with its name, saying it isn't found yet", () => {
    showCollection(theCollection);
    const wizard = tile("wizard");
    expect(wizard).toHaveAttribute("data-held", "missing");
    expect(wizard.querySelector(".hog-silhouette svg")).not.toBeNull();
    expect(within(wizard).getByText("Wizard")).toBeInTheDocument();
    expect(wizard).toHaveTextContent("Not found yet");
  });

  it("tags a found hoggie New until this browser has shown it", () => {
    for (const { seen } of theCollection.hoggies) if (seen !== null && seen !== tile_seen("rocket")) markSeen(seen);
    showCollection(theCollection);
    expect(within(tile("rocket")).getByText("New")).toBeInTheDocument();
    expect(within(tile("coffee-cup")).queryByText("New")).not.toBeInTheDocument();
    cleanup();
    showCollection(theCollection);
    expect(within(tile("rocket")).queryByText("New")).not.toBeInTheDocument();
  });

  function tile_seen(hoggie: string) {
    return theCollection.hoggies.find((entry) => entry.hoggie === hoggie)!.seen;
  }

  it("lists Collection in the page index on a wide screen, current here, and in the picker on a narrow one", () => {
    preferWideScreen();
    showCollection(theCollection);
    const index = within(main()).getByRole("navigation", { name: "Book pages" });
    const entry = within(index).getByRole("link", { name: "Collection" });
    expect(entry).toHaveAttribute("href", "/book/collection");
    expect(entry).toHaveAttribute("aria-current", "page");
    cleanup();
    fakeSystemTheme(false);
    showCollection(theCollection);
    const picker = within(main()).getByRole("combobox", { name: "Book page" });
    expect(picker).toHaveValue("/book/collection");
    expect(within(picker).getByRole("option", { name: "Collection" })).toBeInTheDocument();
  });

  it("gives the overview a Collection tile with the count, and leaves the index and the overview alone while the collection isn't shown", () => {
    window.history.replaceState(null, "", "/book");
    showCollection(theCollection);
    const tileLink = within(main()).getByRole("link", { name: "Collection, 41 of 151 hoggies found" });
    expect(tileLink).toHaveAttribute("href", "/book/collection");
    cleanup();
    preferWideScreen();
    window.history.replaceState(null, "", "/book");
    showCollection(collectionFixtures.notFound);
    expect(within(main()).queryByRole("link", { name: /^Collection/ })).not.toBeInTheDocument();
  });
});
