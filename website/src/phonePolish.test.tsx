import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

describe("#434 1: the Book on a phone shows one eyebrow", () => {
  it("names the page picker for assistive technology without a second visible eyebrow above the Book's own", () => {
    visit("/book");
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.book));
    expect(screen.getByRole("combobox", { name: "Book page" })).toBeInTheDocument();
    expect(screen.queryByText("Book page")).toBeNull();
    expect(screen.getByText("Book", { selector: ".hud-label" })).toBeInTheDocument();
  });
});

describe("#434 3: the home on a phone keeps one alignment", () => {
  it("left-aligns the hero like the panels under it, and only centres nothing", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const hero = within(screen.getByRole("main")).getByRole("region", { name: "Sam Example" });
    expect(hero).toHaveClass("items-start", "text-left");
    expect(hero).not.toHaveClass("items-center", "text-center");
    const column = within(hero).getByRole("heading", { level: 1 }).closest(".flex-1")!;
    expect(column).toHaveClass("items-start");
    expect(column).not.toHaveClass("items-center");
    const kudosLeft = within(hero).getByText("Kudos left today").parentElement!;
    expect(kudosLeft).toHaveClass("justify-start");
    expect(kudosLeft).not.toHaveClass("justify-center");
  });
});

describe("#434 4: a long name on the podium carries the truncation rule and keeps its full name", () => {
  const longName = "Maximiliana Featherstonehaugh-Wojciechowska";
  const board = { ...leaderboardFixtures.midBoard, rows: leaderboardFixtures.midBoard.rows.map((row, i) => (i === 0 ? { ...row, name: longName } : row)) };

  it("carries the truncate class, a title with the full name and the full name as text; the ellipsis itself is measured in the browser (proof README)", () => {
    visit("/leaderboard");
    renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(board));
    const podium = within(screen.getByRole("main")).getByRole("list", { name: "Top three" });
    const spot = within(podium).getAllByRole("listitem").find((item) => item.textContent?.includes(longName))!;
    expect(spot).toBeDefined();
    const name = within(spot).getByTitle(longName);
    expect(name).toHaveClass("truncate");
    expect(name).toHaveTextContent(longName);
    expect(spot).toHaveTextContent(longName);
  });
});

describe("#481 1: on a phone the face and the level ring share one row above the name", () => {
  it("wraps the face and the ring in a row that dissolves from sm, so wide screens keep the hero as it was", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const hero = within(screen.getByRole("main")).getByRole("region", { name: "Sam Example" });
    const face = within(hero).getByText("SE");
    const ring = within(hero).getByRole("img", { name: /^Level 7/ });
    const row = face.parentElement!;
    expect(ring.parentElement).toBe(row);
    expect(row).toHaveClass("flex", "items-center", "sm:contents");
    expect(hero).toHaveClass("flex-col", "sm:flex-row");
    expect(face).toHaveClass("size-28");
  });

  it("keeps the face alone in the row while the member has no level yet", () => {
    renderApp(shellFixtures.member);
    const hero = within(screen.getByRole("main")).getByRole("region", { name: "Sam Example" });
    const row = within(hero).getByText("SE").parentElement!;
    expect(row).toHaveClass("sm:contents");
    expect(within(hero).queryByRole("img", { name: /^Level/ })).toBeNull();
  });
});

describe("#481 2: the Everyone card's standing never wraps", () => {
  it.each([
    { standing: "ranked", answer: leaderboardFixtures.midBoard },
    { standing: "tied", answer: leaderboardFixtures.tiedBelowTheLead },
  ])("keeps the words and the rank on one line when $standing", ({ answer }) => {
    visit("/leaderboard");
    renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(answer));
    const card = within(screen.getByRole("main")).getByRole("heading", { level: 2, name: "Everyone" }).closest("section")!;
    const standing = card.querySelector("[data-rank]")!.parentElement!;
    expect(standing).toHaveClass("whitespace-nowrap", "shrink-0");
  });
});
