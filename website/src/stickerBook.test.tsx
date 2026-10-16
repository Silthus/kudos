import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { MyCollection } from "./collectionRead";
import { markSeen } from "./crates/seen";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const theBook = collectionFixtures.withTheStickerBook;

vi.setConfig({ testTimeout: 90_000 });

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/book/collection");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--hud-height");
});

function main() {
  return screen.getByRole("main");
}

function showCollection(answer: MyCollection) {
  return renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, fixedCollection(answer));
}

function section(name: string) {
  return within(main()).getByRole("region", { name });
}

function elementIn(root: HTMLElement, selector: string) {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Nothing matches ${selector}`);
  return found;
}

function sticker(key: string) {
  return elementIn(main(), `[data-sticker="${key}"]`);
}

function album(group: string) {
  return elementIn(main(), `[data-album="${group}"]`);
}

function copyOf(region: HTMLElement) {
  return region.firstElementChild!.textContent;
}

function jumpList() {
  return within(main()).queryByRole("navigation", { name: "On this page" });
}

function jumpLinks() {
  const list = jumpList();
  return list === null ? [] : within(list).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("#555 SB11 SB13: the Collection's stickers, one of every teammate", () => {
  it("holds a Stickers section after the crests with one sticker per teammate, newest first, and counts them in the summary", () => {
    showCollection(theBook);
    const stickers = section("Stickers");
    expect([...stickers.querySelectorAll("[data-sticker]")].map((tile) => tile.getAttribute("data-sticker"))).toEqual(theBook.stickers!.map(({ key }) => key));
    expect(stickers).toHaveTextContent("12 collected");
    expect(section("Team crests").compareDocumentPosition(stickers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section("Your collection")).toHaveTextContent("12 stickers of teammates");
  });

  it("draws a sticker as the teammate's face, their name and the day you first swapped thanks", () => {
    showCollection(theBook);
    const noor = sticker("k:noor");
    expect(noor.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
    expect(noor.querySelector("img")).toHaveStyle({ backgroundColor: "#f7a35c" });
    expect(within(noor).getByText("Noor Haddad")).toBeInTheDocument();
    expect(within(noor).getByText("14 Oct 2026")).toBeInTheDocument();
    expect(noor).not.toHaveAttribute("data-former");
    const felix = sticker("k:felix");
    expect(felix.querySelector("img")).toBeNull();
    expect(within(felix).getByText("FB")).toBeInTheDocument();
    expect(within(felix).getByText("Felix Brandt")).toBeInTheDocument();
  });

  it("tags a sticker New until this browser has shown it", () => {
    for (const { key, seen } of theBook.stickers!) if (key !== "k:noor") markSeen(seen);
    showCollection(theBook);
    expect(within(sticker("k:noor")).getByText("New")).toBeInTheDocument();
    expect(within(sticker("k:felix")).queryByText("New")).not.toBeInTheDocument();
    cleanup();
    showCollection(theBook);
    expect(within(sticker("k:noor")).queryByText("New")).not.toBeInTheDocument();
  });

  it("keeps a former teammate's sticker, named as the directory still names them or as A teammate with the nameless face", () => {
    showCollection(theBook);
    const rafael = sticker("k:rafael");
    expect(rafael).toHaveAttribute("data-former");
    expect(within(rafael).getByText("Rafael Costa")).toBeInTheDocument();
    expect(rafael).toHaveTextContent("Former teammate");
    const gone = sticker("k:gone");
    expect(within(gone).getByText("A teammate")).toBeInTheDocument();
    expect(within(gone).getByText("?")).toBeInTheDocument();
    expect(gone).toHaveTextContent("28 Aug 2026");
  });

  it("says No stickers yet with Max's line and one Slack action while the book is open but holds none, with or without albums", () => {
    showCollection(collectionFixtures.withNoStickersYet);
    const stickers = section("Stickers");
    expect(stickers).toHaveTextContent("0 collected");
    expect(stickers.querySelectorAll("[data-sticker]")).toHaveLength(0);
    expect(stickers).toHaveTextContent("No stickers yet. Thank a teammate in Slack, or get thanked, and their sticker lands here.");
    expect(within(stickers).getByRole("link", { name: /Thank someone in Slack/ })).toHaveAttribute("href", shellFixtures.memberWithTheBookOpened.chatUrl);
    expect(section("Your collection")).toHaveTextContent("No stickers of teammates yet");
    expect(album("platform")).toHaveTextContent("0 of 6");
    expect(album("platform").querySelectorAll("[data-held='held']")).toHaveLength(0);
    cleanup();
    showCollection(collectionFixtures.withNoStickersAndNoAlbums);
    expect(within(section("Stickers")).getByRole("link", { name: /Thank someone in Slack/ })).toBeInTheDocument();
    expect(within(main()).queryByRole("region", { name: "Group albums" })).not.toBeInTheDocument();
    expect(jumpLinks().map(([name]) => name)).toEqual(["Hoggies", "Team crests", "Stickers"]);
  });

  it("names no sticker and no album while the answer carries none, as main does", () => {
    showCollection(collectionFixtures.collection);
    expect(main()).not.toHaveTextContent(/sticker|album/i);
    expect(within(main()).queryByRole("region", { name: "Stickers" })).not.toBeInTheDocument();
  });
});

describe("#555 SB7 SB9 SB13: group albums, one per Slack group, filled by thanking its people", () => {
  it("lists every album after the stickers, the member's own groups first, each with how many of its people are held", () => {
    showCollection(theBook);
    const albums = section("Group albums");
    expect(section("Stickers").compareDocumentPosition(albums) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...albums.querySelectorAll("[data-album]")].map((card) => card.getAttribute("data-album"))).toEqual(["platform", "support", "design", "growth", "new-starters"]);
    expect(within(album("platform")).getByRole("heading", { level: 3, name: "Platform" })).toBeInTheDocument();
    expect(album("platform")).toHaveTextContent("4 of 6");
    expect(within(album("platform")).getByText("Your group")).toBeInTheDocument();
    expect(within(album("support")).getByText("Your group")).toBeInTheDocument();
    expect(within(album("design")).queryByText("Your group")).not.toBeInTheDocument();
    expect(album("support")).toHaveTextContent("5 of 5");
  });

  it("shows an album's people by name: held ones as their sticker's face, missing ones as silhouettes, and says who is still missing", () => {
    showCollection(theBook);
    const platform = album("platform");
    const people = [...platform.querySelectorAll<HTMLElement>("[data-album-person]")];
    expect(people.map((person) => person.dataset.albumPerson)).toEqual(["k:felix", "k:hana", "k:jonas", "k:noor", "k:omar", "k:priya"]);
    expect(people.map((person) => person.dataset.held)).toEqual(["held", "missing", "held", "held", "missing", "held"]);
    const noor = elementIn(platform, '[data-album-person="k:noor"]');
    expect(noor.querySelector("img")).toHaveAttribute("src", sticker("k:noor").querySelector("img")!.getAttribute("src"));
    expect(noor).toHaveAttribute("title", "Noor Haddad");
    const hana = elementIn(platform, '[data-album-person="k:hana"]');
    expect(hana.querySelector("img")).toBeNull();
    expect(hana.querySelector("[data-silhouette]")).not.toBeNull();
    expect(hana).toHaveAttribute("title", "Hana Kowalski");
    const roster = within(platform).getByText("Held: Felix Brandt, Jonas Weber, Noor Haddad, Priya Natarajan. Still missing: Hana Kowalski, Omar Siddiqui.");
    expect(roster.closest("[aria-hidden]")).toBeNull();
    expect(roster).not.toHaveClass("sr-only");
    expect(within(album("support")).getByText("Everyone here: Amara Okonkwo, Leo Fischer, Mei Tanaka, Sofia Esposito, Tomás Rivera.").closest("[aria-hidden]")).toBeNull();
  });

  it("says when a group has no one else in it yet", () => {
    showCollection(theBook);
    expect(album("new-starters")).toHaveTextContent("No one else in this group yet");
    expect(album("new-starters").querySelectorAll("[data-album-person]")).toHaveLength(0);
  });

  it("shows the stickers alone while groups aren't shown", () => {
    showCollection(collectionFixtures.withStickersOnly);
    expect(section("Stickers")).toBeInTheDocument();
    expect(within(main()).queryByRole("region", { name: "Group albums" })).not.toBeInTheDocument();
    expect(main()).not.toHaveTextContent(/album/i);
  });

  it("never calls an album a team or a crest a group, and never calls a sticker a hoggie", () => {
    showCollection(theBook);
    expect(section("Group albums")).not.toHaveTextContent(/team|crest/i);
    expect(copyOf(section("Team crests"))).not.toMatch(/group|album/i);
    expect(section("Stickers")).not.toHaveTextContent(/hoggie/i);
  });
});

describe("#555: the Collection's sections and the jump list at the top", () => {
  it("wraps the rarities in a Hoggies section after the summary, with the crests after it", () => {
    showCollection(theBook);
    const hoggies = section("Hoggies");
    expect(hoggies).toHaveAttribute("id", "hoggies");
    expect(hoggies).toContainElement(section("🟧 Legendary"));
    expect(within(hoggies).getByRole("heading", { level: 3, name: "🟧 Legendary" })).toBeInTheDocument();
    expect(hoggies).toHaveTextContent("41 of 151 found");
    expect(section("Your collection").compareDocumentPosition(hoggies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hoggies.compareDocumentPosition(section("Team crests")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links every section from a jump list under the title, each to its anchor", () => {
    showCollection(theBook);
    expect(jumpLinks()).toEqual([
      ["Hoggies", "#hoggies"],
      ["Team crests", "#team-crests"],
      ["Stickers", "#stickers"],
      ["Group albums", "#group-albums"],
    ]);
    for (const [name, href] of jumpLinks()) expect(document.getElementById(href!.slice(1))).toBe(section(name!));
    expect(jumpList()!.compareDocumentPosition(section("Your collection")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lands a jump below the HUD whatever its height: the sections' scroll margin follows the measured sticky header, until the shell unmounts", () => {
    const observers: FakeResizeObserver[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class FakeResizeObserver {
        observed: Element[] = [];
        disconnected = false;
        constructor(public callback: ResizeObserverCallback) {
          observers.push(this);
        }
        observe(element: Element) {
          this.observed.push(element);
        }
        disconnect() {
          this.disconnected = true;
        }
      },
    );
    const { unmount } = showCollection(theBook);
    const header = document.querySelector<HTMLElement>("header.sticky")!;
    const live = observers.filter((observer) => !observer.disconnected);
    expect(live).toHaveLength(1);
    expect(live[0]!.observed).toEqual([header]);
    Object.defineProperty(header, "offsetHeight", { configurable: true, value: 140 });
    live[0]!.callback([], live[0] as unknown as ResizeObserver);
    expect(document.documentElement.style.getPropertyValue("--hud-height")).toBe("140px");
    expect(section("Stickers").style.scrollMarginTop).toBe("calc(var(--hud-height, 96px) + 1rem)");
    unmount();
    expect(live[0]!.disconnected).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--hud-height")).toBe("");
  });

  it("publishes and clears the HUD's height even where ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { unmount } = showCollection(theBook);
    expect(document.documentElement.style.getPropertyValue("--hud-height")).toBe("0px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--hud-height")).toBe("");
  });

  type FakeResizeObserver = { callback: ResizeObserverCallback; observed: Element[]; disconnected: boolean };

  it("lists only the sections the answer carries, and needs none while there is one section", () => {
    showCollection(collectionFixtures.withStickersOnly);
    expect(jumpLinks().map(([name]) => name)).toEqual(["Hoggies", "Team crests", "Stickers"]);
    cleanup();
    showCollection(collectionFixtures.collection);
    expect(jumpLinks().map(([name]) => name)).toEqual(["Hoggies", "Team crests"]);
    cleanup();
    showCollection(collectionFixtures.collectionWithoutCrests);
    expect(jumpList()).toBeNull();
  });
});
