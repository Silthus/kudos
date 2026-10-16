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

vi.setConfig({ testTimeout: 90_000 });

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

  it("is the not-found page while getCollection answers not-found, whatever getBook says", () => {
    showCollection(collectionFixtures.notFound, { member: shellFixtures.memberWaitingForTheBook, book: bookFixtures.locked });
    expect(pageTitle()).toHaveTextContent("Page not found");
    cleanup();
    showCollection(collectionFixtures.notFound, { member: shellFixtures.memberWithTheBookReady, book: bookFixtures.ready });
    expect(pageTitle()).toHaveTextContent("Page not found");
    expect(within(main()).queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
  });

  it("shows the locked page while getCollection answers locked", () => {
    showCollection(collectionFixtures.locked, { member: shellFixtures.memberWaitingForTheBook, book: bookFixtures.locked });
    expect(pageTitle()).toHaveTextContent("Unlocks at level 1");
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

  it("draws a found hoggie in full art on its rarity's colour, with its name, the date it was first found and ×{count} past the first copy", () => {
    showCollection(theCollection);
    const coffeeCup = tile("coffee-cup");
    expect(within(coffeeCup).getByText("16 Sept 2026")).toBeInTheDocument();
    expect(within(tile("wizard")).queryByText(/2026/)).not.toBeInTheDocument();
    expect(coffeeCup).toHaveAttribute("data-held", "found");
    expect(coffeeCup).toHaveAttribute("data-rarity", "common");
    expect(coffeeCup.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/coffee-cup\.png$/));
    expect(coffeeCup.querySelector(".hog-silhouette")).toBeNull();
    expect(within(coffeeCup).getByText("Coffee Cup")).toBeInTheDocument();
    expect(within(coffeeCup).getByText("×4")).toBeInTheDocument();
    expect(within(tile("ball")).queryByText(/^×/)).not.toBeInTheDocument();
  });

  it("draws a missing hoggie as a silhouette with its name, saying it isn't found yet", () => {
    showCollection(theCollection);
    const wizard = tile("wizard");
    expect(wizard).toHaveAttribute("data-held", "missing");
    expect(wizard.querySelector<HTMLElement>(".hog-silhouette [data-silhouette-art]")!.style.getPropertyValue("--art")).toMatch(/wizard-1\.png"\)$/);
    expect(wizard.querySelector("img")).toBeNull();
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

  it("tags a hoggie that arrives while the page is open New, and marks it seen", () => {
    const [rocket] = theCollection.hoggies.filter(({ hoggie }) => hoggie === "rocket");
    const beforeTheRocket = { ...theCollection, hoggies: theCollection.hoggies.map((entry) => (entry === rocket ? { ...entry, count: 0, firstAt: null, seen: null } : entry)), owned: 40 };
    for (const { seen } of theCollection.hoggies) if (seen !== null && seen !== rocket!.seen) markSeen(seen);
    let answer: MyCollection = beforeTheRocket;
    const { showVisitor } = showCollection(beforeTheRocket, { read: (asking) => (asking ? answer : undefined) });
    expect(within(tile("rocket")).queryByText("New")).not.toBeInTheDocument();
    answer = theCollection;
    showVisitor(shellFixtures.memberWithTheBookOpened);
    expect(within(tile("rocket")).getByText("New")).toBeInTheDocument();
    expect(within(tile("rocket")).getByText("14 Oct 2026")).toBeInTheDocument();
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
    expect(tileLink).toHaveAccessibleDescription("⬜ Common 24 of 60, 🟩 Uncommon 9 of 40, 🟦 Rare 5 of 30, 🟪 Epic 2 of 15, 🟧 Legendary 1 of 6");
    cleanup();
    preferWideScreen();
    window.history.replaceState(null, "", "/book");
    showCollection(collectionFixtures.notFound);
    expect(within(main()).queryByRole("link", { name: /^Collection/ })).not.toBeInTheDocument();
  });
});

describe("#468: the Collection's team crests, each a set of hoggies", () => {
  function crestsSection() {
    return within(main()).getByRole("region", { name: "Team crests" });
  }

  function crestTile(crest: string) {
    const found = main().querySelector<HTMLElement>(`[data-crest="${crest}"]`);
    if (found === null) throw new Error(`No tile for ${crest}`);
    return found;
  }

  function coinsIn(tile: HTMLElement) {
    return [...tile.querySelectorAll<HTMLElement>("[data-coin]")].map((coin) => coin.dataset.coin);
  }

  it("lists all 54 crests in the answer's order in a Team crests section before the rarities, counting the collected ones", () => {
    showCollection(theCollection);
    const section = crestsSection();
    expect(section).toHaveTextContent("2 of 54 collected");
    expect([...section.querySelectorAll("[data-crest]")].map((tile) => tile.getAttribute("data-crest"))).toEqual(theCollection.crests!.map(({ crest }) => crest));
    expect(section.compareDocumentPosition(raritySection("🟧 Legendary")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(main()).getByRole("region", { name: "Your collection" })).toHaveTextContent("2 of 54 team crests collected");
  });

  it("draws a collected crest in full art with its whole roster found, the date it was collected, and New until this browser has shown it", () => {
    for (const { seen } of theCollection.crests!) if (seen !== null && !seen.startsWith("crest:people-ops:")) markSeen(seen);
    showCollection(theCollection);
    const peopleOps = crestTile("people-ops");
    expect(peopleOps).toHaveAttribute("data-held", "collected");
    expect(peopleOps.querySelector("[data-crest-art='collected'] img")).toHaveAttribute("src", expect.stringMatching(/people-ops\.png$/));
    expect(within(peopleOps).getByText("People & Ops")).toBeInTheDocument();
    expect(coinsIn(peopleOps)).toEqual(["found", "found", "found"]);
    expect(within(peopleOps).getByText("7 Oct 2026")).toBeInTheDocument();
    expect(peopleOps).toHaveTextContent("Roster complete: Heart, Namaste, Coconut.");
    expect(within(peopleOps).getByText("New")).toBeInTheDocument();
    expect(within(crestTile("platform-ux")).queryByText("New")).not.toBeInTheDocument();
    cleanup();
    showCollection(theCollection);
    expect(within(crestTile("people-ops")).queryByText("New")).not.toBeInTheDocument();
  });

  it("shows an uncollected crest dimmed with its roster's progress: held hoggies in full, missing ones as silhouettes, and which are still missing", () => {
    showCollection(theCollection);
    const customerSuccess = crestTile("customer-success-eu");
    expect(customerSuccess).toHaveAttribute("data-held", "progress");
    expect(customerSuccess.querySelector("[data-crest-art='missing'] img")).not.toBeNull();
    expect(coinsIn(customerSuccess)).toEqual(["missing", "found", "missing"]);
    expect(customerSuccess).toHaveTextContent("1 of 3");
    expect(customerSuccess).toHaveTextContent("Held: Croissant. Still missing: Gladiator, Hooligan.");
    expect(within(customerSuccess).queryByText(/2026/)).not.toBeInTheDocument();
    expect(crestTile("ai-gateway")).toHaveTextContent("0 of 3");
    expect(crestTile("ai-gateway")).toHaveTextContent("Still missing: Transformer, Traffic Controller, Cursor.");
    expect(crestTile("ai-gateway")).not.toHaveTextContent("Held:");
  });

  it("leaves the crests out while the answer carries none", () => {
    showCollection(collectionFixtures.collectionWithoutCrests);
    expect(within(main()).queryByRole("region", { name: "Team crests" })).not.toBeInTheDocument();
    expect(main()).not.toHaveTextContent("crests");
  });
});
