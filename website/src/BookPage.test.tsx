import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ladders, type LadderId } from "../../convex/achievements/ladders";
import { ladderCategories } from "./book/categories";
import { bookFixtures, fixedBook } from "./bookFixtures";
import type { BookRead } from "./bookRead";
import { Root } from "./Root";
import { shellFixtures, type CommandAnswer, type MyBook } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

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

describe("WS80 WS81: the fixture build's /book agrees with its member", () => {
  it.each([
    ["member-with-nothing-shipped", "Page not found"],
    ["member-waiting-for-the-book", "Book"],
    ["member-with-the-book-ready", "Book"],
    ["member-with-the-book-opened", "Achievements"],
  ])("%s shows %s", (fixture, title) => {
    render(<Root fixture={fixture} />);
    expect(pageTitle()).toHaveTextContent(title);
  });

  it("shows the locked sentence for a member waiting for the Book, and the crate for one whose Book is ready", () => {
    const waiting = render(<Root fixture="member-waiting-for-the-book" />);
    expect(main()).toHaveTextContent("Book opens at level 4.");
    waiting.unmount();
    render(<Root fixture="member-with-the-book-ready" />);
    expect(within(main()).getByRole("heading", { name: "Unlocks: Book" })).toBeInTheDocument();
  });
});

function bookPages() {
  return screen.getByRole("navigation", { name: "Book pages" });
}

function ladderNames() {
  return within(main())
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

function showBookAt(path: string, answer: MyBook = bookFixtures.everyLadder) {
  window.history.replaceState(null, "", path);
  return showBook(answer);
}

const categoryPages = [
  { page: "giving", name: "Giving", blurb: "Thanks you hand out, day after day and month after month.", ladders: ["Generosity", "Dependability", "Seasons"] },
  { page: "thanked", name: "Being thanked", blurb: "Thanks that find their way back to you.", ladders: ["Recognition"] },
  { page: "connections", name: "Connections", blurb: "The people you thank and old friends.", ladders: ["Connections", "Old Friends"] },
  { page: "crowd", name: "Crowd", blurb: null, ladders: ["Applause"] },
];

describe("WS331: the Book's page index", () => {
  it("shows a Book pages column on a wide screen: the Book, Overview, then each category in E's order", () => {
    preferWideScreen();
    showBookAt("/book");
    expect(within(bookPages()).getByText("Book")).toBeInTheDocument();
    const entries = within(bookPages()).getAllByRole("link");
    expect(entries.map((entry) => [entry.textContent, entry.getAttribute("href")])).toEqual([
      ["Overview", "/book"],
      ["Giving", "/book?page=giving"],
      ["Being thanked", "/book?page=thanked"],
      ["Connections", "/book?page=connections"],
      ["Crowd", "/book?page=crowd"],
    ]);
    expect(screen.queryByRole("combobox", { name: "Book page" })).toBeNull();
  });

  it("marks the current page, and only it, with the stripe in primary", () => {
    preferWideScreen();
    showBookAt("/book?page=connections");
    const current = within(bookPages()).getByRole("link", { name: "Connections" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.outerHTML).toMatch(/primary/);
    for (const other of within(bookPages()).getAllByRole("link").filter((entry) => entry !== current)) {
      expect(other).not.toHaveAttribute("aria-current");
      expect(other.outerHTML).not.toMatch(/primary/);
    }
  });

  it("gives each category its emblem and the overview none", () => {
    preferWideScreen();
    showBookAt("/book");
    const emblemsOf = (name: string) => within(bookPages()).getByRole("link", { name }).querySelectorAll("[data-emblem]").length;
    expect(categoryPages.map(({ name }) => emblemsOf(name))).toEqual([1, 1, 1, 1]);
    expect(within(bookPages()).getByRole("link", { name: "Overview" }).querySelector("[data-emblem]")).toBeNull();
  });

  it("lists only the categories that hold a ladder the read returns", () => {
    preferWideScreen();
    showBookAt("/book", bookFixtures.book);
    expect(within(bookPages()).getAllByRole("link").map((entry) => entry.textContent)).toEqual(["Overview", "Giving", "Being thanked"]);
  });

  it("is a native select with option groups on a narrow screen", () => {
    showBookAt("/book");
    const select = screen.getByRole("combobox", { name: "Book page" });
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveValue("/book");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Overview", "Giving", "Being thanked", "Connections", "Crowd"]);
    expect(within(select).getByRole("group", { name: "Achievements" })).toHaveTextContent("GivingBeing thankedConnectionsCrowd");
    expect(screen.queryByRole("navigation", { name: "Book pages" })).toBeNull();
  });

  it("follows the select to a category without a reload, moving focus to its title", async () => {
    const { user } = showBookAt("/book");
    await user.selectOptions(screen.getByRole("combobox", { name: "Book page" }), "Crowd");
    expect(window.location.pathname + window.location.search).toBe("/book?page=crowd");
    expect(pageTitle()).toHaveTextContent("Crowd");
    expect(pageTitle()).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Book page" })).toHaveValue("/book?page=crowd");
  });

  it("follows an index entry without a reload, moving focus to the page's title, and back with the browser", async () => {
    preferWideScreen();
    const { user } = showBookAt("/book");
    await user.click(within(bookPages()).getByRole("link", { name: "Giving" }));
    expect(window.location.search).toBe("?page=giving");
    expect(pageTitle()).toHaveTextContent("Giving");
    expect(pageTitle()).toHaveFocus();
    expect(within(bookPages()).getByRole("link", { name: "Giving" })).toHaveAttribute("aria-current", "page");

    await act(async () => {
      window.history.back();
      await waitFor(() => expect(window.location.search).toBe(""));
    });
    expect(pageTitle()).toHaveTextContent("Achievements");
  });

  it("serves the overview at /book, turning ?page=overview into /book", () => {
    showBookAt("/book?page=overview");
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(window.location.pathname + window.location.search).toBe("/book");
  });

  it("shows the overview for a page it doesn't know, at /book", () => {
    showBookAt("/book?page=albums");
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(window.location.pathname + window.location.search).toBe("/book");
  });

  it("shows the overview for a category whose ladders the read doesn't return", () => {
    preferWideScreen();
    showBookAt("/book?page=crowd", bookFixtures.book);
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(within(bookPages()).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the overview's every ladder in catalogue order until the overview ships", () => {
    showBookAt("/book");
    expect(ladderNames()).toEqual(ladders.ladders.map(({ name }) => name));
  });
});

describe("WS332: the Book's category pages", () => {
  it.each(categoryPages)("/book?page=$page shows $name with its blurb and its ladders in catalogue order", ({ page, name, blurb, ladders: shown }) => {
    showBookAt(`/book?page=${page}`);
    expect(pageTitle()).toHaveTextContent(name);
    expect(document.title).toBe(`HedgeHug · Book · ${name}`);
    expect(within(main()).getByText("Achievements", { selector: ".hud-label" })).toBeInTheDocument();
    const header = pageTitle().closest("header")!;
    expect(within(header).queryByRole("paragraph")?.textContent ?? null).toBe(blurb);
    expect(ladderNames()).toEqual(shown);
  });

  it("names no unshipped thing on any page: no albums, no chime-ins", () => {
    for (const { page } of categoryPages) {
      const view = showBookAt(`/book?page=${page}`);
      expect(main()).not.toHaveTextContent(/album|chime|sticker|coin|reward/i);
      view.unmount();
    }
  });

  it("keys every shipped ladder to a category", () => {
    const unkeyed = ladders.ladders.map(({ ladder }) => ladder).filter((ladder) => !Object.hasOwn(ladderCategories, ladder));
    expect(unkeyed).toEqual([]);
  });

  it("puts a ladder a newer backend returns, with no category yet, on the last category that holds a ladder", () => {
    const newer = { ...bookFixtures.book.ladders[0], ladder: "team-spirit" as LadderId, name: "Team Spirit" };
    showBookAt("/book?page=thanked", { ...bookFixtures.book, ladders: [...bookFixtures.book.ladders, newer] });
    expect(ladderNames()).toEqual(["Recognition", "Team Spirit"]);
  });
});
