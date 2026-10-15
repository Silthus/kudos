import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { ladderCategories } from "./book/categories";
import { bookFixtures, fixedBook, withCoinRewards, withStoreRewards } from "./bookFixtures";
import { shellFixtures, type LadderCard, type MyBook } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const firstThanksAt = Date.parse("2026-10-13T22:30:00Z");

const siteCss = readFileSync(join(__dirname, "index.css"), "utf8");

function hexIn(css: string, token: string) {
  return new RegExp(`--${token}: (#[0-9a-f]{6});`).exec(css)![1]!;
}

function luminance(colour: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(one: string, other: string) {
  const [a, b] = [luminance(one), luminance(other)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
});

function main() {
  return screen.getByRole("main");
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function showBookAt(path: string, answer: MyBook = bookFixtures.withCoins, member = shellFixtures.memberWithTheBookOpened) {
  window.history.replaceState(null, "", path);
  return renderApp(member, undefined, undefined, undefined, fixedBook(answer));
}

function tierCell(ladder: string, tierName: string) {
  const card = within(main()).getByRole("heading", { level: 2, name: ladder }).closest("article")!;
  return within(card).getByText(tierName).closest("li")!;
}

function shelved() {
  return within(within(main()).getByRole("list", { name: "Recently earned" })).getAllByRole("listitem");
}

function earnedTiers() {
  return within(within(main()).getByRole("list", { name: "Tiers earned" })).getAllByRole("listitem");
}

function moment() {
  return main().querySelector("[data-moment]");
}

function book(...ladders: LadderCard[]): MyBook {
  return { ...bookFixtures.book, ladders };
}

const generosity = bookFixtures.withCoins.ladders.find(({ ladder }) => ladder === "generosity")!;

const recognition = bookFixtures.withCoins.ladders.find(({ ladder }) => ladder === "recognition")!;

function earnedWith(ladder: LadderCard, earnedAt: number): LadderCard {
  return { ...ladder, count: 1, tiers: ladder.tiers.map((tier, i) => (i === 0 ? { ...tier, earnedAt, seen: `${ladder.ladder}-bronze-${earnedAt}` } : tier)), next: { tier: "silver", at: ladder.tiers[1]!.at } };
}

describe("WS347 WS91: each tier's reward line in the Book", () => {
  it("names each tier's coin reward on its ladder card, earned or not, and nothing on a tier without one", () => {
    showBookAt(`/book?page=${ladderCategories.generosity}`);
    expect(tierCell("Generosity", "First Thanks")).toHaveTextContent("10 coins");
    expect(tierCell("Generosity", "Patron of Praise")).toHaveTextContent("100 coins");
    expect(tierCell("Generosity", "Generous Soul")).not.toHaveTextContent(/coin|reward/i);
    expect(tierCell("Generosity", "Heart of the Team")).not.toHaveTextContent(/coin|reward/i);
  });

  it("names no reward while getBook carries none, as while coins aren't visible", () => {
    showBookAt(`/book?page=${ladderCategories.generosity}`, bookFixtures.everyLadder);
    expect(main()).not.toHaveTextContent(/coin|reward/i);
  });

  it("gives the reward line words a screen reader reads with its tier", () => {
    showBookAt(`/book?page=${ladderCategories.generosity}`);
    expect(within(tierCell("Generosity", "First Thanks")).getByText("Reward:", { exact: false })).toHaveClass("sr-only");
  });

  it("shows each shelved tier's reward on the recently earned shelf, and says it in the entry's name", () => {
    preferWideScreen();
    showBookAt("/book");
    const [firstThanks, constellationMaker, oldFriends] = shelved();
    expect(firstThanks).toHaveTextContent("+10 coins");
    expect(within(firstThanks!).getByRole("link")).toHaveAccessibleName(expect.stringMatching(/First Thanks.*, reward 10 coins/));
    expect(constellationMaker).toHaveTextContent("+100 coins");
    expect(oldFriends).not.toHaveTextContent(/coin|reward/i);
  });
});

describe("WS347 ST20: a tier's kudos emoji reward", () => {
  const silverAt = Date.parse("2026-10-14T08:00:00Z");
  const generosityAtSilver: LadderCard = {
    ...withStoreRewards(bookFixtures.everyLadder.ladders[0]!),
    count: 25,
    tiers: withStoreRewards(bookFixtures.everyLadder.ladders[0]!).tiers.map((tier, i) => (i < 2 ? { ...tier, earnedAt: i === 0 ? firstThanksAt : silverAt, seen: `generosity-${tier.tier}` } : tier)),
    next: { tier: "gold", at: 100 },
  };

  it("names the silver tier's emoji with its glyph on the ladder card", () => {
    showBookAt(`/book?page=${ladderCategories.generosity}`, bookFixtures.withStore);
    const silver = tierCell("Generosity", "Generous Soul");
    expect(silver).toHaveTextContent("Reward: 🎀Ribbon emoji");
    expect(within(silver).getByText("🎀")).toHaveAttribute("aria-hidden", "true");
    expect(tierCell("Generosity", "First Thanks")).toHaveTextContent("10 coins");
  });

  it("shows a shelved silver tier's emoji, and says it in the entry's name", () => {
    preferWideScreen();
    showBookAt("/book", bookFixtures.withStore);
    const oldFriends = shelved().find((entry) => entry.textContent?.includes("Old Friends"))!;
    expect(oldFriends).toHaveTextContent("🧸Teddy Bear emoji");
    expect(within(oldFriends).getByRole("link")).toHaveAccessibleName(expect.stringMatching(/, reward the Teddy Bear emoji$/));
  });

  it("keeps every shelved entry's date on one row by reserving a reward row while any of them shows a reward", () => {
    preferWideScreen();
    showBookAt("/book", bookFixtures.withStore);
    expect(shelved().map((entry) => entry.querySelector("[data-shelf-rewards]") !== null)).toEqual([true, true, true, true, true]);
    expect(shelved().find((entry) => entry.textContent?.includes("Pillar"))!.querySelector("[data-shelf-rewards]")).toBeEmptyDOMElement();
  });

  it("reserves no reward row while no shelved entry shows a reward", () => {
    preferWideScreen();
    showBookAt("/book", bookFixtures.everyLadder);
    expect(main().querySelector("[data-shelf-rewards]")).toBeNull();
  });

  it("celebrates a silver tier with its emoji on the earned page", () => {
    showBookAt("/book/earned", book(generosityAtSilver));
    expect(pageTitle()).toHaveTextContent("You earned Generous Soul");
    expect(earnedTiers()[0]).toHaveTextContent("🎀Ribbon emoji");
    expect(main()).toHaveTextContent("25 kudos given. The Ribbon emoji is yours.");
  });

  it("joins every reward of one tier in its sentence", () => {
    const both = { ...generosityAtSilver, tiers: generosityAtSilver.tiers.map((tier) => (tier.tier === "silver" ? { ...tier, rewards: [{ kind: "coins" as const, coins: 10 }, ...tier.rewards] } : tier)) };
    showBookAt("/book/earned", book(both));
    expect(main()).toHaveTextContent("25 kudos given. 10 coins and the Ribbon emoji are yours.");
  });
});

describe("WS347: the achievement-earned page", () => {
  it("is /book/earned, celebrating the newest earned tier with its medal and reward under the Book's nav entry", () => {
    showBookAt("/book/earned");
    expect(pageTitle()).toHaveTextContent("You earned First Thanks");
    expect(document.title).toBe("HedgeHug · Achievement");
    expect(main()).toHaveTextContent("Achievement · Generosity");
    const [firstThanks] = earnedTiers();
    expect(firstThanks).toHaveTextContent("Bronze · Generosity");
    expect(firstThanks!.querySelectorAll("[data-medal='earned'] [data-pip]")).toHaveLength(1);
    expect(firstThanks).toHaveTextContent("+10 coins");
    expect(main()).toHaveTextContent("1 kudos given. 10 coins are yours.");
    expect(screen.getByRole("link", { name: "Book", current: "page" })).toBeInTheDocument();
  });

  it("celebrates together every tier one kudos earned, and only those", () => {
    const at = Date.parse("2026-10-14T08:00:00Z");
    showBookAt("/book/earned", book(earnedWith(generosity, at), earnedWith(recognition, at), withCoinRewards(bookFixtures.everyLadder.ladders[2]!)));
    expect(pageTitle()).toHaveTextContent("You earned First Thanks and Noticed");
    expect(main()).toHaveTextContent("Achievements · Generosity and Recognition");
    expect(earnedTiers().map((tier) => tier.textContent)).toEqual([expect.stringContaining("Bronze · Generosity"), expect.stringContaining("Bronze · Recognition")]);
  });

  it("names no reward for a tier whose reward isn't shown", () => {
    showBookAt("/book/earned", bookFixtures.everyLadder);
    expect(main()).not.toHaveTextContent(/coin|reward/i);
    expect(main()).toHaveTextContent("1 kudos given.");
  });

  it("plays its reveal once per tier: the first visit is fresh, the next shows the end state", () => {
    const first = showBookAt("/book/earned");
    expect(moment()).toHaveAttribute("data-moment", "fresh");
    first.unmount();
    showBookAt("/book/earned");
    expect(moment()).toHaveAttribute("data-moment", "seen");
    expect(pageTitle()).toHaveTextContent("You earned First Thanks");
  });

  it("is fresh again for a newer tier, keyed by its own seen key", () => {
    showBookAt("/book/earned").unmount();
    showBookAt("/book/earned", book(earnedWith(generosity, firstThanksAt), earnedWith(recognition, firstThanksAt + 60_000)));
    expect(pageTitle()).toHaveTextContent("You earned Noticed");
    expect(moment()).toHaveAttribute("data-moment", "fresh");
  });

  it("leads to the Book with See achievements, without a reload, and back to Slack in a new tab", async () => {
    const { user } = showBookAt("/book/earned");
    expect(within(main()).getByRole("link", { name: /Back to Slack/ })).toHaveAttribute("href", shellFixtures.memberWithTheBookOpened.chatUrl);
    await user.click(within(main()).getByRole("link", { name: "See achievements" }));
    expect(window.location.pathname).toBe("/book");
    expect(pageTitle()).toHaveTextContent("Achievements");
  }, 15_000);

  it("says nothing is earned yet, and leads to the Book, before the member's first tier", () => {
    showBookAt("/book/earned", bookFixtures.nothingEarned);
    expect(pageTitle()).toHaveTextContent("No tiers earned yet");
    expect(within(main()).getByRole("link", { name: "See achievements" })).toHaveAttribute("href", "/book");
    expect(moment()).toBeNull();
  });

  it("answers like /book while the Book is locked", () => {
    showBookAt("/book/earned", bookFixtures.locked, shellFixtures.memberWaitingForTheBook);
    expect(pageTitle()).toHaveTextContent("Unlocks at level 4");
  });

  it("animates only without a reduced-motion preference, and never loops", () => {
    const css = readFileSync(join(__dirname, "book", "earned.css"), "utf8");
    const motionBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(css.indexOf("animation")).toBeGreaterThan(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(motionBlock).toContain('[data-moment="fresh"]');
    expect(css).not.toMatch(/infinite/);
  });

  it("keeps the band's words, the plaque and the reward pill at 4.5:1 on E's lemon", () => {
    expect(contrast(hexIn(siteCss, "band-lemon-ink"), hexIn(siteCss, "band-lemon"))).toBeGreaterThanOrEqual(4.5);
    expect(readFileSync(join(__dirname, "book", "earned.css"), "utf8")).toMatch(/\.earned-plaque \{\s*background-color: var\(--band-lemon-ink\);[\s\S]*\.earned-pill \{\s*background-color: var\(--band-lemon-ink\);\s*color: var\(--band-lemon\);/);
  });

  for (const [mode, selector] of [["light", ":root"], ["dark", ".dark"]] as const) {
    it.each(["bronze", "silver", "gold", "diamond"])(`keeps the %s medal at 3:1 on the plaque's ink in ${mode}`, (tier) => {
      const block = siteCss.slice(siteCss.indexOf(`${selector} {`), siteCss.indexOf("}", siteCss.indexOf(`${selector} {`)));
      expect(contrast(hexIn(block, `medal-${tier}`), hexIn(siteCss, "band-lemon-ink"))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("WS339: tier rewards and the earned page pass axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const { name, path } of [
      { name: "the earned page", path: "/book/earned" },
      { name: "a category page with reward lines", path: `/book?page=${ladderCategories.generosity}` },
      { name: "the overview's shelf with rewards", path: "/book" },
    ]) {
      it(`${name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        showBookAt(path);
        const results = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
        expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ html }) => html).join(", ")}`)).toEqual([]);
      }, 30_000);
    }
  }
});
