import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ladders, type LadderId } from "../../convex/achievements/ladders";
import { ladderCategories } from "./book/categories";
import { bookFixtures, fixedBook } from "./bookFixtures";
import type { BookRead } from "./bookRead";
import { Root } from "./Root";
import { shellFixtures, type CommandAnswer, type LadderCard, type MyBook } from "./shell";
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

function openLadder(answer: Extract<MyBook, { kind: "book" }>, name: string) {
  cleanup();
  const ladder = answer.ladders.find((card) => card.name === name)!;
  window.history.replaceState(null, "", `/book?page=${ladderCategories[ladder.ladder]}`);
  showBook(answer);
  return ladderCard(name);
}

describe("WS80: /book answers like the leaderboard", () => {
  it("is the not-found page while getBook answers not-found", () => {
    showBook(bookFixtures.notFound, shellFixtures.memberWithTheBoardOpened);
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("says Max's Book opens at level 4. with Back to your profile while getBook answers locked", () => {
    showBook(bookFixtures.locked, shellFixtures.memberWaitingForTheBook);
    expect(pageTitle()).toHaveTextContent("Book");
    expect(document.title).toBe("HedgeHug · Book");
    expect(main()).toHaveTextContent("Book opens at level 4.");
    expect(within(main()).getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/");
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

  it("shows each ladder on its page as one plain card with its name and what it counts", () => {
    expect(openLadder(bookFixtures.book, "Generosity")).toHaveTextContent("kudos given");
    expect(ladderCard("Generosity")).not.toHaveClass("hud-panel");
    expect(openLadder(bookFixtures.book, "Recognition")).toHaveTextContent("kudos received");
  });

  it("lists the four tiers in order, each with its word and its name", () => {
    const tiers = within(within(openLadder(bookFixtures.book, "Generosity")).getByRole("list", { name: "Generosity tiers" })).getAllByRole("listitem");
    expect(tiers.map((tier) => tier.textContent)).toEqual([
      expect.stringMatching(/^Bronze.*First Thanks/),
      expect.stringMatching(/^Silver.*Generous Soul/),
      expect.stringMatching(/^Gold.*Heart of the Team/),
      expect.stringMatching(/^Diamond.*Patron of Praise/),
    ]);
  });

  it("prints an earned tier's date in the member's time zone", () => {
    openLadder(bookFixtures.book, "Generosity");
    expect(tierOf("Generosity", "First Thanks")).toHaveTextContent("Earned 14 Oct 2026");
  });

  it("shows the next tier with the count it needs and a neutral Next tag", () => {
    openLadder(bookFixtures.book, "Generosity");
    const next = tierOf("Generosity", "Generous Soul");
    expect(next).toHaveTextContent("At 25");
    const tag = within(next).getByText("Next");
    expect(tag.outerHTML).not.toMatch(/primary/);
    expect(next).not.toHaveTextContent("Earned");
  });

  it("shows a later tier with only the count it needs", () => {
    openLadder(bookFixtures.book, "Generosity");
    const later = tierOf("Generosity", "Heart of the Team");
    expect(later).toHaveTextContent("At 100");
    expect(within(later).queryByText("Next")).toBeNull();
    expect(later).not.toHaveTextContent("Earned");
  });

  it("exposes the way to the next tier as a neutral progressbar labelled count of at for the tier's name", () => {
    const bar = within(openLadder(bookFixtures.book, "Generosity")).getByRole("progressbar", { name: "3 of 25 for Generous Soul" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "25");
    expect(bar.outerHTML).not.toMatch(/primary|success|warning|danger/);
    expect(within(openLadder(bookFixtures.book, "Recognition")).getByRole("progressbar", { name: "0 of 1 for Noticed" })).toBeInTheDocument();
  });

  it("shows a ladder with every tier earned with four dates and no Next tag", () => {
    const card = openLadder(bookFixtures.everyTierEarned, "Generosity");
    expect(within(card).queryByText("Next")).toBeNull();
    expect(within(card).getAllByRole("listitem").map((tier) => tier.textContent)).toEqual(["Bronze", "Silver", "Gold", "Diamond"].map((word) => expect.stringMatching(new RegExp(`^${word}.*Earned \\d{1,2} \\w+ 2026$`))));
  });

  it("shows a ladder's emblem in silhouette while no tier is earned", () => {
    expect(openLadder(bookFixtures.book, "Recognition").querySelector("[data-emblem]")).toHaveAttribute("data-emblem", "silhouette");
    expect(openLadder(bookFixtures.book, "Generosity").querySelector("[data-emblem]")).toHaveAttribute("data-emblem", "earned");
  });

  it("gives each medal one to four pips by tier, a sparkle only on gold and diamond, and an outline while unearned", () => {
    openLadder(bookFixtures.book, "Generosity");
    const medalOf = (tierName: string) => tierOf("Generosity", tierName).querySelector("[data-medal]")!;
    expect(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"].map((name) => medalOf(name).querySelectorAll("[data-pip]").length)).toEqual([1, 2, 3, 4]);
    expect(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"].map((name) => medalOf(name).querySelector("[data-sparkle]") !== null)).toEqual([false, false, true, true]);
    expect(medalOf("First Thanks")).toHaveAttribute("data-medal", "earned");
    expect(medalOf("Generous Soul")).toHaveAttribute("data-medal", "outline");
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

  it("keeps the read's order when a ladder with no category comes before the last category's own", () => {
    const [generosity, recognition] = bookFixtures.book.ladders;
    const newer = { ...generosity, ladder: "team-spirit" as LadderId, name: "Team Spirit" };
    showBookAt("/book?page=thanked", { ...bookFixtures.book, ladders: [generosity, newer, recognition] });
    expect(ladderNames()).toEqual(["Team Spirit", "Recognition"]);
  });
});


function nextCells(name: string) {
  return within(within(ladderCard(name)).getByRole("list", { name: `${name} tiers` }))
    .getAllByRole("listitem")
    .filter((cell) => within(cell).queryByText("Next") !== null);
}

describe("WS333: ladder details", () => {
  it("names the highest earned tier and its date, in the member's time zone, beside each ladder's name, or Not started", () => {
    const headline = (name: string) => within(openLadder(bookFixtures.everyStage, name)).getByRole("heading", { level: 2, name }).parentElement!;
    expect(headline("Generosity")).toHaveTextContent("Bronze earned 14 Oct 2026");
    expect(headline("Dependability")).toHaveTextContent("Gold earned 22 Jul 2026");
    expect(headline("Connections")).toHaveTextContent("Diamond earned 8 Sept 2026");
    expect(headline("Recognition")).toHaveTextContent("Not started");
  });

  it("says under the bar how many are left to the next tier, by its name, from the read's at and count", () => {
    expect(openLadder(bookFixtures.everyStage, "Recognition")).toHaveTextContent("1 to go for Noticed");
    expect(openLadder(bookFixtures.everyStage, "Generosity")).toHaveTextContent("22 to go for Generous Soul");
    const dependability = openLadder(bookFixtures.everyStage, "Dependability");
    expect(dependability).toHaveTextContent("10 to go for Cornerstone");
    const bar = within(dependability).getByRole("progressbar", { name: "240 of 250 for Cornerstone" });
    expect(bar.compareDocumentPosition(within(dependability).getByText("10 to go for Cornerstone"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows Complete and a full neutral bar after the fourth tier, with nothing left to go", () => {
    const card = openLadder(bookFixtures.everyStage, "Connections");
    const bar = within(card).getByRole("progressbar", { name: "Complete, 31 different people thanked" });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "1");
    expect(bar.outerHTML).not.toMatch(/primary|success|warning|danger/);
    expect(card).toHaveTextContent("Complete");
    expect(bar.parentElement).toHaveTextContent(/^31$/);
    expect(card).not.toHaveTextContent(/to go/);
    expect(nextCells("Connections")).toEqual([]);
  });

  it("rings one Next cell per incomplete ladder in the foreground colour, with no primary anywhere on a ladder", () => {
    const incomplete = ["Generosity", "Recognition", "Dependability", "Applause", "Seasons", "Old Friends"];
    for (const name of incomplete) {
      const card = openLadder(bookFixtures.everyLadder, name);
      const cells = nextCells(name);
      expect(cells).toHaveLength(1);
      expect(cells[0]).toHaveClass("ring-foreground");
      expect(card.outerHTML).not.toMatch(/primary/);
    }
    openLadder(bookFixtures.everyLadder, "Dependability");
    expect(within(nextCells("Dependability")[0]!).getByText("Cornerstone")).toBeInTheDocument();
  });

  it("frames the emblem in a rosette of the highest earned tier's metal, with a static sparkle only for gold and diamond", () => {
    const rosette = (name: string) => openLadder(bookFixtures.everyStage, name).querySelector("[data-rosette]")!;
    expect(["Generosity", "Recognition", "Connections", "Dependability"].map((name) => rosette(name).getAttribute("data-rosette"))).toEqual(["bronze", "none", "diamond", "gold"]);
    expect(["Generosity", "Recognition", "Connections", "Dependability"].map((name) => rosette(name).querySelector("[data-sparkle]") !== null)).toEqual([false, false, true, true]);
    expect(rosette("Connections").closest("[aria-hidden='true']")).not.toBeNull();
    expect(ladderCard("Connections").innerHTML).not.toMatch(/animate|animation/);
  });
});


function overview() {
  return within(main()).getByRole("region", { name: "Your tiers" });
}

function closestNextTier() {
  return within(main()).queryByRole("link", { name: /^Closest next tier/ });
}

function shelf() {
  return within(main()).queryByRole("list", { name: "Recently earned" });
}

function shelved() {
  return within(shelf()!).getAllByRole("listitem");
}

function categoryTiles() {
  return within(within(main()).getByRole("list", { name: "Pages" })).getAllByRole("link");
}

const [generosityAtBronze, recognitionNotYet] = bookFixtures.book.ladders;

function earnedOnly(ladders: LadderCard[]): MyBook {
  return { ...bookFixtures.book, ladders };
}

describe("WS334: the Book's overview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says how many tiers of every shipped ladder the member has earned, with a neutral bar", () => {
    showBookAt("/book");
    expect(within(overview()).getByRole("heading", { level: 2 })).toHaveTextContent("14 of 28 tiers earned");
    expect(overview()).toHaveTextContent("Across 7 ladders.");
    const bar = within(overview()).getByRole("progressbar", { name: "14 of 28 tiers earned" });
    expect(bar).toHaveAttribute("aria-valuenow", "14");
    expect(bar).toHaveAttribute("aria-valuemax", "28");
    expect(bar.outerHTML).not.toMatch(/primary|success|warning|danger/);
  });

  it("shows E's book-reading hedgehog", () => {
    showBookAt("/book");
    const hog = overview().querySelector("[data-hog='reading']");
    expect(hog).toBeInTheDocument();
    expect(hog!.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("leads to the ladder with the fewest left to its next tier, naming the tier and how many to go, with a neutral Next tag", () => {
    showBookAt("/book");
    const closest = closestNextTier()!;
    expect(closest).toHaveAttribute("href", "/book?page=thanked");
    expect(closest).toHaveTextContent("Noticed");
    expect(closest).toHaveTextContent("Bronze · Recognition");
    expect(closest).toHaveTextContent("1 to go");
    expect(closest.querySelector("[data-emblem]")).toHaveAttribute("data-emblem", "silhouette");
    expect(within(closest).getByText("Next").outerHTML).not.toMatch(/primary/);
  });

  it("breaks a tie for the closest next tier in catalogue order", () => {
    showBookAt("/book", earnedOnly([{ ...generosityAtBronze!, count: 24 }, recognitionNotYet!]));
    expect(closestNextTier()).toHaveTextContent("Generous Soul");
    expect(closestNextTier()).toHaveAttribute("href", "/book?page=giving");
  });

  it("follows the closest next tier to its page without a reload", async () => {
    const { user } = showBookAt("/book");
    await user.click(closestNextTier()!);
    expect(window.location.search).toBe("?page=thanked");
    expect(pageTitle()).toHaveTextContent("Being thanked");
  });

  it("has no closest next tier once every ladder is complete", () => {
    const complete = bookFixtures.everyTierEarned.ladders[0]!;
    showBookAt("/book", earnedOnly([complete]));
    expect(closestNextTier()).toBeNull();
    expect(within(overview()).getByRole("heading", { level: 2 })).toHaveTextContent("4 of 4 tiers earned");
  });

  it("never shows a received total and never names another member", () => {
    const recognitionNearSilver = { ...recognitionNotYet!, count: 23, tiers: recognitionNotYet!.tiers.map((tier, i) => (i === 0 ? { ...tier, earnedAt: Date.parse("2026-05-02T09:00:00Z") } : tier)), next: { tier: "silver" as const, at: 25 } };
    showBookAt("/book", earnedOnly([{ ...generosityAtBronze!, count: 20 }, recognitionNearSilver]));
    expect(closestNextTier()).toHaveTextContent("Appreciated");
    expect(closestNextTier()).toHaveTextContent("2 to go");
    expect(main()).not.toHaveTextContent(/23|received/);
  });

  it("names no reward, coin, sticker or album, and lists no ladder card", () => {
    showBookAt("/book");
    expect(main()).not.toHaveTextContent(/coin|emoji|reward|sticker|album/i);
    expect(within(main()).queryAllByRole("article")).toEqual([]);
  });

  it("shelves the latest earned tier of each ladder, newest first, five on a wide screen, each with its medal and date", () => {
    preferWideScreen();
    showBookAt("/book");
    expect(shelved().map((entry) => entry.textContent)).toEqual([
      expect.stringMatching(/First Thanks.*Bronze · 14 Oct 2026/),
      expect.stringMatching(/Constellation Maker.*Diamond · 8 Sept 2026/),
      expect.stringMatching(/Old Friends.*Silver · 14 Aug 2026/),
      expect.stringMatching(/Pillar.*Gold · 22 Jul 2026/),
      expect.stringMatching(/Half-Year Hero.*Gold · 30 Jun 2026/),
    ]);
    expect(shelved().map((entry) => entry.querySelector("[data-rosette]")?.getAttribute("data-rosette"))).toEqual(["bronze", "diamond", "silver", "gold", "gold"]);
    expect(shelved().map((entry) => entry.querySelectorAll("[data-medal='earned'] [data-pip]").length)).toEqual([1, 4, 2, 3, 3]);
    expect(within(shelved()[1]!).getByRole("link")).toHaveAttribute("href", "/book?page=connections");
    expect(main()).toHaveTextContent("Newest first");
  });

  it("shelves three on a narrow screen", () => {
    showBookAt("/book");
    expect(shelved().map((entry) => within(entry).getByRole("link").textContent)).toEqual([
      expect.stringContaining("First Thanks"),
      expect.stringContaining("Constellation Maker"),
      expect.stringContaining("Old Friends"),
    ]);
  });

  it("tags the newest New, as a static tag, while it was earned less than 7 days ago", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-20T22:29:59.999Z"));
    showBookAt("/book");
    const newest = shelved()[0]!;
    expect(within(newest).getByText("New").outerHTML).not.toMatch(/primary|animate/);
    expect(shelved().filter((entry) => within(entry).queryByText("New") !== null)).toEqual([newest]);
  });

  it("drops New once the newest was earned 7 days ago", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-20T22:30:00Z"));
    showBookAt("/book");
    expect(within(shelf()!).queryByText("New")).toBeNull();
  });

  it("tags only the newest New when two were earned this week", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-14T12:00:00Z"));
    const recognitionYesterday = { ...recognitionNotYet!, count: 1, tiers: recognitionNotYet!.tiers.map((tier, i) => (i === 0 ? { ...tier, earnedAt: Date.parse("2026-10-13T09:00:00Z") } : tier)), next: { tier: "silver" as const, at: 25 } };
    showBookAt("/book", earnedOnly([generosityAtBronze!, recognitionYesterday]));
    expect(shelved().map((entry) => within(entry).queryByText("New") !== null)).toEqual([true, false]);
    expect(shelved()[0]).toHaveTextContent("First Thanks");
  });

  it("has no shelf while no tier is earned", () => {
    showBookAt("/book", earnedOnly([recognitionNotYet!]));
    expect(shelf()).toBeNull();
    expect(main()).not.toHaveTextContent("Recently earned");
  });

  it("gives each category that holds a ladder one tile, in E's order, with its art, its ladders' emblems, its tiers earned and a neutral bar", () => {
    showBookAt("/book");
    expect(categoryTiles().map((tile) => [tile.textContent, tile.getAttribute("href")])).toEqual([
      [expect.stringMatching(/^Giving.*7 of 12/), "/book?page=giving"],
      [expect.stringMatching(/^Being thanked.*0 of 4/), "/book?page=thanked"],
      [expect.stringMatching(/^Connections.*6 of 8/), "/book?page=connections"],
      [expect.stringMatching(/^Crowd.*1 of 4/), "/book?page=crowd"],
    ]);
    const giving = categoryTiles()[0]!;
    expect(giving.querySelector("[data-hog='giving']")).not.toBeNull();
    expect(giving.querySelectorAll("[data-emblem]")).toHaveLength(3);
    const bar = giving.querySelector("[data-bar]")!;
    expect(bar.closest("[aria-hidden='true']")).not.toBeNull();
    expect(bar.outerHTML).not.toMatch(/primary|success|warning|danger/);
  });

  it("tiles only the categories that hold a ladder the read returns", () => {
    showBookAt("/book", bookFixtures.book);
    expect(categoryTiles().map((tile) => tile.getAttribute("href"))).toEqual(["/book?page=giving", "/book?page=thanked"]);
  });
});
