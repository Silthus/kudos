import { cleanup, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { MyCollection } from "./collectionRead";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function bookPanel() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Book" });
}

function showHome(collection: MyCollection) {
  return renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fixedCollection(collection));
}

describe("#467: the home's Book panel carries the collection's progress", () => {
  it("shows how many hoggies are found of the total, the latest find with its art and rarity, and a link to the collection beside the Book's", () => {
    showHome(collectionFixtures.collection);
    const panel = bookPanel();
    const bar = within(panel).getByRole("progressbar", { name: "41 of 151 hoggies found" });
    expect(bar).toHaveAttribute("aria-valuenow", "41");
    expect(panel).toHaveTextContent("Latest find");
    expect(panel).toHaveTextContent("Rocket");
    expect(panel).toHaveTextContent("🟧 Legendary");
    expect(panel.querySelector("[data-latest-find='rocket'] img")).toHaveAttribute("src", expect.stringMatching(/rocket\.png$/));
    expect(within(panel).getByRole("link", { name: "See your collection" })).toHaveAttribute("href", "/book/collection");
    expect(within(panel).getByRole("link", { name: "Open the Book" })).toHaveAttribute("href", "/book");
    expect(panel).not.toHaveTextContent("See the tiers you've earned.");
  });

  it("invites the first find while nothing is found yet", () => {
    showHome(collectionFixtures.nothingFound);
    const panel = bookPanel();
    expect(within(panel).getByRole("progressbar", { name: "0 of 151 hoggies found" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Every crate you open drops one hoggie.");
    expect(panel).not.toHaveTextContent("Latest find");
  });

  it("keeps the Book's line and link while the collection isn't shown", () => {
    for (const answer of [collectionFixtures.notFound, { kind: "signed-out" } as const]) {
      cleanup();
      showHome(answer);
      expect(bookPanel()).toHaveTextContent("See the tiers you've earned.");
      expect(within(bookPanel()).getByRole("link", { name: "Open the Book" })).toHaveAttribute("href", "/book");
      expect(within(bookPanel()).queryByRole("progressbar")).not.toBeInTheDocument();
    }
  });
});

describe("#468: the home's Book panel counts the team crests beside the hoggies", () => {
  it("says how many crests are collected of the total", () => {
    showHome(collectionFixtures.collection);
    expect(bookPanel()).toHaveTextContent("41 of 151 hoggies found · 2 of 54 crests");
  });

  it("says nothing about crests while the answer carries none", () => {
    showHome(collectionFixtures.collectionWithoutCrests);
    expect(bookPanel()).toHaveTextContent("41 of 151 hoggies found");
    expect(bookPanel()).not.toHaveTextContent("crests");
  });
});
