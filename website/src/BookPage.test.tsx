import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import type { BookRead } from "./bookRead";
import { shellFixtures, type CommandAnswer, type MyBook } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/book");
});

function main() {
  return screen.getByRole("main");
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function dialog() {
  return screen.queryByRole("dialog");
}

function ladderCard(name: string) {
  return within(main()).getByRole("heading", { level: 2, name }).closest("article")!;
}

function tierOf(ladder: string, tierName: string) {
  return within(ladderCard(ladder)).getByText(tierName).closest("li")!;
}

function showBook(answer: MyBook, member = shellFixtures.memberWithTheBookOpened) {
  return renderApp(member, undefined, undefined, undefined, fixedBook(answer));
}

describe("WS80: /book answers like the leaderboard", () => {
  it("is the not-found page while getBook answers not-found", () => {
    showBook(bookFixtures.notFound, shellFixtures.memberWithTheBoardOpened);
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("says Max's Book opens at level 4. with Go to Home while getBook answers locked", () => {
    showBook(bookFixtures.locked, shellFixtures.memberWaitingForTheBook);
    expect(pageTitle()).toHaveTextContent("Book");
    expect(document.title).toBe("HedgeHug · Book");
    expect(main()).toHaveTextContent("Book opens at level 4.");
    expect(within(main()).getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
  });

  it("shows the Book's crate in place with a primary Open while getBook answers ready, and opens it through openFeature", async () => {
    const openFeature = vi.fn(async (): Promise<CommandAnswer> => ({ kind: "opened" }));
    const { user } = renderApp(shellFixtures.memberWithTheBookReady, undefined, { openFeature }, undefined, fixedBook(bookFixtures.ready));
    const crate = within(main()).getByRole("heading", { name: "Unlocks: Book" }).closest("article")!;
    const open = within(crate).getByRole("button", { name: "Open" });
    expect(open).toHaveClass("quill-button--variant-primary");

    await user.click(open);

    expect(openFeature).toHaveBeenCalledWith("book");
  });

  it("becomes the Book once opened, with focus on its title when the reveal closes", async () => {
    let answer: MyBook = bookFixtures.ready;
    const readBook: BookRead = (asking) => (asking ? answer : undefined);
    const { user, showVisitor } = renderApp(shellFixtures.memberWithTheBookReady, undefined, { openFeature: async () => ({ kind: "opened" }) }, undefined, readBook);
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    answer = bookFixtures.book;
    showVisitor(shellFixtures.memberWithTheBookOpened);
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(pageTitle()).toHaveFocus();
  });

  it("asks getBook only on /book", () => {
    const readBook = vi.fn<BookRead>(() => undefined);
    window.history.replaceState(null, "", "/");
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, readBook);
    expect(readBook).not.toHaveBeenCalledWith(true);
  });

  it("marks the page busy while getBook loads", () => {
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, () => undefined);
    expect(main()).toHaveAttribute("aria-busy", "true");
  });

  it("follows a denial to its page", () => {
    showBook({ kind: "signed-out" });
    expect(within(main()).getByRole("button", { name: /Sign in with Slack/ })).toBeInTheDocument();
  });
});

describe("WS92: the Book page", () => {
  it("lives at /book with the tab HedgeHug · Book, the label Book, the title Achievements and its one line", () => {
    showBook(bookFixtures.book);
    expect(document.title).toBe("HedgeHug · Book");
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(within(main()).getByText("Book", { selector: ".hud-label" })).toBeInTheDocument();
    expect(main()).toHaveTextContent("Tiers you earn by thanking colleagues and being thanked. Each one is yours for good.");
  });

  it("shows one plain card per ladder in the read's order, each with its name and what it counts", () => {
    showBook(bookFixtures.book);
    const names = within(main())
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Generosity", "Recognition"]);
    expect(ladderCard("Generosity")).toHaveTextContent("kudos given");
    expect(ladderCard("Recognition")).toHaveTextContent("kudos received");
    expect(ladderCard("Generosity")).not.toHaveClass("hud-panel");
  });

  it("lists the four tiers in order, each with its word and its name", () => {
    showBook(bookFixtures.book);
    const tiers = within(within(ladderCard("Generosity")).getByRole("list", { name: "Generosity tiers" })).getAllByRole("listitem");
    expect(tiers.map((tier) => tier.textContent)).toEqual([
      expect.stringMatching(/^Bronze.*First Thanks/),
      expect.stringMatching(/^Silver.*Generous Soul/),
      expect.stringMatching(/^Gold.*Heart of the Team/),
      expect.stringMatching(/^Diamond.*Patron of Praise/),
    ]);
  });

  it("prints an earned tier's date in the member's time zone", () => {
    showBook(bookFixtures.book);
    expect(tierOf("Generosity", "First Thanks")).toHaveTextContent("Earned 14 Oct 2026");
  });

  it("shows the next tier with the count it needs and a neutral Next tag", () => {
    showBook(bookFixtures.book);
    const next = tierOf("Generosity", "Generous Soul");
    expect(next).toHaveTextContent("At 25");
    const tag = within(next).getByText("Next");
    expect(tag.outerHTML).not.toMatch(/primary/);
    expect(next).not.toHaveTextContent("Earned");
  });

  it("shows a later tier with only the count it needs", () => {
    showBook(bookFixtures.book);
    const later = tierOf("Generosity", "Heart of the Team");
    expect(later).toHaveTextContent("At 100");
    expect(within(later).queryByText("Next")).toBeNull();
    expect(later).not.toHaveTextContent("Earned");
  });

  it("exposes the way to the next tier as a neutral progressbar labelled count of at for the tier's name", () => {
    showBook(bookFixtures.book);
    const bar = within(ladderCard("Generosity")).getByRole("progressbar", { name: "3 of 25 for Generous Soul" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "25");
    expect(bar.outerHTML).not.toMatch(/primary|success|warning|danger/);
    expect(within(ladderCard("Recognition")).getByRole("progressbar", { name: "0 of 1 for Noticed" })).toBeInTheDocument();
  });

  it("shows a ladder with every tier earned with four dates, no bar and no Next tag", () => {
    showBook(bookFixtures.everyTierEarned);
    const card = ladderCard("Generosity");
    expect(within(card).queryByRole("progressbar")).toBeNull();
    expect(within(card).queryByText("Next")).toBeNull();
    expect(within(card).getAllByRole("listitem").map((tier) => tier.textContent)).toEqual(["Bronze", "Silver", "Gold", "Diamond"].map((word) => expect.stringMatching(new RegExp(`^${word}.*Earned \\d{1,2} \\w+ 2026$`))));
  });

  it("shows a ladder's emblem in silhouette while no tier is earned", () => {
    showBook(bookFixtures.book);
    expect(ladderCard("Recognition").querySelector("[data-emblem]")).toHaveAttribute("data-emblem", "silhouette");
    expect(ladderCard("Generosity").querySelector("[data-emblem]")).toHaveAttribute("data-emblem", "earned");
  });

  it("gives each medal one to four pips by tier, a sparkle only on gold and diamond, and an outline while unearned", () => {
    showBook(bookFixtures.book);
    const medalOf = (tierName: string) => tierOf("Generosity", tierName).querySelector("[data-medal]")!;
    expect(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"].map((name) => medalOf(name).querySelectorAll("[data-pip]").length)).toEqual([1, 2, 3, 4]);
    expect(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"].map((name) => medalOf(name).querySelector("[data-sparkle]") !== null)).toEqual([false, false, true, true]);
    expect(medalOf("First Thanks")).toHaveAttribute("data-medal", "earned");
    expect(medalOf("Generous Soul")).toHaveAttribute("data-medal", "outline");
  });

  it("never totals tiers, ranks ladders by the closest tier, names a reward, or names stickers and albums", () => {
    showBook(bookFixtures.book);
    expect(main()).not.toHaveTextContent(/tiers earned|of 8|closest|coin|emoji|hedgehog|reward|sticker|album|title/i);
  });
});

describe("WS81: the Book's nav entry follows the page", () => {
  it("marks Book current in the nav while the Book is shown", async () => {
    showBook(bookFixtures.book);
    await act(async () => undefined);
    expect(within(screen.getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Book" })).toHaveAttribute("aria-current", "page");
  });
});
