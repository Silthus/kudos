import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { tiersEarned } from "./book/progress";
import { landOnHoggieTile, markLanded } from "./book/spread/landing";
import { collectionFixtures } from "./collectionFixtures";
import type { Collection, CollectionShown } from "./collectionRead";
import { markSeen } from "./crates/seen";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

vi.setConfig({ testTimeout: 60_000 });

const theBook = bookFixtures.everyLadder;

const theCollection = collectionFixtures.collection;

const rocket = theCollection.hoggies.find(({ hoggie }) => hoggie === "rocket")!;

const peopleOps = theCollection.crests!.find(({ crest }) => crest === "people-ops")!;

const withTheBookSpread = (member: MemberProfile): MemberProfile => ({ ...member, bookSpread: true });

const reader = withTheBookSpread(shellFixtures.memberWithTheBookOpened);

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  localStorage.clear();
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function address() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function showBook(member: MemberProfile, collection: CollectionShown = theCollection, commands: Parameters<typeof renderApp>[2] = {}) {
  return renderApp(member, undefined, commands, undefined, fixedBook(theBook), undefined, undefined, undefined, undefined, undefined, undefined, (asking) => (asking ? collection : undefined));
}

function main() {
  return screen.getByRole("main");
}

function pageTabs() {
  return within(main()).getByRole("navigation", { name: "Book pages" });
}

function tab(name: RegExp | string) {
  return within(pageTabs()).getByRole("link", { name });
}

function book() {
  return main().querySelector<HTMLElement>("[data-spread]")!;
}

function page(side: "left" | "right") {
  return book().querySelector<HTMLElement>(`[data-page="${side}"]`)!;
}

function tilesIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("[data-hoggie]")];
}

function tile(hoggie: string) {
  return main().querySelector<HTMLElement>(`[data-hoggie="${hoggie}"]`)!;
}

async function flipTo(name: RegExp | string, { user }: ReturnType<typeof renderApp>) {
  await user.click(tab(name));
}

describe("#585: with book-spread on, /book and /book/collection render one open book with page tabs; off, today's pages", () => {
  it("keeps today's Book index, overview and Collection page while the profile carries no bookSpread", () => {
    visit("/book");
    showBook(shellFixtures.memberWithTheBookOpened);
    expect(within(main()).getByRole("navigation", { name: "Book pages" })).toHaveTextContent("Overview");
    expect(within(main()).queryByRole("link", { name: "Cover" })).toBeNull();
    expect(main().querySelector("[data-spread]")).toBeNull();
    cleanup();
    visit("/book/collection");
    showBook(shellFixtures.memberWithTheBookOpened);
    expect(within(main()).getByRole("region", { name: "Your collection" })).toBeInTheDocument();
    expect(main().querySelector("[data-spread]")).toBeNull();
  });

  it("opens /book on the cover: tabs with counts on the top edge, the Hoggies chapter at a glance on the left, Teams, Achievements and what's new on the right, and no Book index", () => {
    visit("/book");
    showBook(reader);
    expect(within(main()).queryByRole("link", { name: "Overview" })).toBeNull();
    expect(within(main()).queryByRole("combobox", { name: "Book page" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your book");
    const tabs = within(pageTabs()).getAllByRole("link");
    expect(tabs.map((link) => [link.getAttribute("href"), link.getAttribute("aria-current")])).toEqual([
      ["/book#cover", "page"],
      ["/book#hoggies/legendary", null],
      ["/book#teams", null],
      ["/book#achievements", null],
    ]);
    const tiers = tiersEarned(theBook.ladders);
    expect(tab("Cover")).toBeInTheDocument();
    expect(tab("Hoggies, 41 of 151 found")).toHaveTextContent("41/151");
    expect(tab("Teams, 2 of 54 crests")).toHaveTextContent("2/54");
    expect(tab(`Achievements, ${tiers.earned} of ${tiers.total} tiers`)).toHaveTextContent(`${tiers.earned}/${tiers.total}`);
    expect(book()).toHaveAttribute("data-spread", "cover");
    const left = page("left");
    expect(within(left).getByRole("link", { name: /41 of 151 hoggies found/ })).toHaveAttribute("href", "/book#hoggies/legendary");
    expect(within(left).getByRole("link", { name: /Legendary/ })).toHaveTextContent("1/6");
    expect(within(left).getByRole("link", { name: /Legendary/ })).toHaveTextContent("2%");
    expect(within(left).getByRole("link", { name: /Common/ })).toHaveAttribute("href", "/book#hoggies/common");
    const right = page("right");
    expect(within(right).getByRole("link", { name: /2 of 54 crests/ })).toHaveAttribute("href", "/book#teams");
    expect(within(right).getByRole("link", { name: new RegExp(`${tiers.earned} of ${tiers.total} tiers`) })).toHaveAttribute("href", "/book#achievements");
    expect(within(right).getByRole("heading", { name: "New since your last visit" })).toBeInTheDocument();
    expect(within(right).getByRole("link", { name: /Rocket/ })).toHaveAttribute("href", `/book#hoggies/${rocket.rarity}`);
  });

  it("renders /book/collection as the same cover", () => {
    visit("/book/collection");
    showBook(reader);
    expect(book()).toHaveAttribute("data-spread", "cover");
    expect(tab("Cover")).toHaveAttribute("aria-current", "page");
  });

  it("says one quiet line when nothing is new since the last visit", () => {
    for (const { seen } of theCollection.hoggies) if (seen !== null) markSeen(seen);
    for (const { seen } of theCollection.crests!) if (seen !== null) markSeen(seen);
    visit("/book");
    showBook(reader);
    expect(page("right")).toHaveTextContent("Nothing new since your last visit.");
    expect(within(page("right")).queryByRole("link", { name: /Rocket/ })).toBeNull();
  });

  it("flips to a rarity's spread from the Hoggies tab: the contents on the left with the current rarity selected, that rarity's tiles on the right, and previous and next rarities", async () => {
    visit("/book");
    const app = showBook(reader);
    await flipTo(/^Hoggies/, app);
    expect(address()).toBe("/book#hoggies/legendary");
    expect(book()).toHaveAttribute("data-spread", "hoggies");
    expect(tab(/^Hoggies/)).toHaveAttribute("aria-current", "page");
    const contents = within(page("left")).getAllByRole("link");
    expect(contents.map((row) => [row.getAttribute("href"), row.getAttribute("aria-current")])).toEqual([
      ["/book#hoggies/legendary", "page"],
      ["/book#hoggies/epic", null],
      ["/book#hoggies/rare", null],
      ["/book#hoggies/uncommon", null],
      ["/book#hoggies/common", null],
    ]);
    expect(within(page("right")).getByRole("heading", { name: /Legendary/ })).toBeInTheDocument();
    expect(page("right")).toHaveTextContent("1 of 6 found");
    expect(tilesIn(page("right")).map((entry) => entry.dataset.rarity)).toEqual(Array<string>(6).fill("legendary"));
    expect(within(page("right")).queryByRole("link", { name: /Previous/ })).toBeNull();
    await app.user.click(within(page("right")).getByRole("link", { name: /Next.*Epic/ }));
    expect(address()).toBe("/book#hoggies/epic");
    expect(tilesIn(page("right"))).toHaveLength(15);
    expect(within(page("right")).getByRole("link", { name: /Previous.*Legendary/ })).toHaveAttribute("href", "/book#hoggies/legendary");
    expect(tile("level-up")).toHaveAttribute("data-rarity", "epic");
    expect(main().querySelector('[data-hoggie="coffee-cup"]')).toBeNull();
  });

  it("draws a rarity's tiles with name, date and New, and keeps Use as avatar on them", async () => {
    for (const { seen } of theCollection.hoggies) if (seen !== null && !seen.startsWith("hoggie:rocket:")) markSeen(seen);
    visit(`/book#hoggies/${rocket.rarity}`);
    const setAvatar = vi.fn(async () => ({ kind: "set", avatar: null }) as const);
    const app = showBook(withTheBookSpread({ ...shellFixtures.memberWithTheBookOpened, avatar: null }), theCollection, { setAvatar });
    const rocketTile = tile("rocket");
    expect(within(rocketTile).getByText("Rocket")).toBeInTheDocument();
    expect(within(rocketTile).getByText("14 Oct 2026")).toBeInTheDocument();
    expect(within(rocketTile).getByText("New")).toBeInTheDocument();
    await app.user.click(within(rocketTile).getByRole("button", { name: "Use as avatar: Rocket" }));
    expect(setAvatar).toHaveBeenCalledWith("rocket");
    expect(within(page("left")).getByRole("region", { name: "Your avatar" })).toBeInTheDocument();
  });

  it("lands on the spread the hash names and keeps the hash through the route's canonicalisation", () => {
    visit("/book?junk=1#hoggies/rare");
    showBook(reader);
    expect(address()).toBe("/book#hoggies/rare");
    expect(tilesIn(page("right"))).toHaveLength(30);
    cleanup();
    visit("/book/collection#teams/people-ops");
    showBook(reader);
    expect(address()).toBe("/book/collection#teams/people-ops");
    expect(book()).toHaveAttribute("data-spread", "team");
  });

  it("opens /book?page=giving on the Giving achievements spread and keeps the address", () => {
    visit("/book?page=giving");
    showBook(reader);
    expect(address()).toBe("/book?page=giving");
    expect(book()).toHaveAttribute("data-spread", "achievements");
    expect(tab(/^Achievements/)).toHaveAttribute("aria-current", "page");
    expect(within(page("left")).getByRole("link", { name: /^Giving/ })).toHaveAttribute("aria-current", "page");
    expect(within(page("left")).getByRole("link", { name: /^Recently earned/ })).toHaveAttribute("href", "/book#achievements");
    expect(within(page("right")).getByRole("heading", { level: 2, name: "Giving" })).toBeInTheDocument();
    expect(within(page("right")).getByRole("heading", { name: "Generosity" })).toBeInTheDocument();
    expect(within(page("right")).queryByRole("heading", { name: "Recognition" })).toBeNull();
  });

  it("opens the Achievements tab on the recently earned list, the closest next tier on the left", async () => {
    visit("/book");
    const app = showBook(reader);
    await flipTo(/^Achievements/, app);
    expect(address()).toBe("/book#achievements");
    expect(within(page("left")).getByText("Closest next")).toBeInTheDocument();
    expect(within(page("right")).getByRole("heading", { level: 2, name: "Recently earned" })).toBeInTheDocument();
    expect(within(page("right")).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("lays the Teams spread out from today's crests and group albums: your teams and pages started on the left, the rest on the right", async () => {
    visit("/book");
    const app = showBook(reader, collectionFixtures.withTheStickerBook);
    await flipTo(/^Teams/, app);
    expect(address()).toBe("/book#teams");
    expect(book()).toHaveAttribute("data-spread", "teams");
    const left = page("left");
    expect(within(left).getByRole("heading", { name: "Your teams" })).toBeInTheDocument();
    expect(within(left).getByRole("link", { name: /^Platform\s?\d/ })).toHaveAttribute("href", "/book#teams/group:platform");
    expect(within(left).getByRole("link", { name: /^Support\s?\d/ })).toBeInTheDocument();
    expect(within(left).getByRole("heading", { name: "Pages started" })).toBeInTheDocument();
    expect(within(left).getByRole("link", { name: new RegExp(`^${peopleOps.name}\\s?\\d`) })).toHaveAttribute("href", "/book#teams/people-ops");
    expect(within(left).getByRole("heading", { name: "Stickers" })).toBeInTheDocument();
    expect(left).toHaveTextContent("12 stickers of teammates");
    const stickers = within(within(left).getByRole("list", { name: "Stickers" })).getAllByRole("listitem");
    expect(stickers.map((item) => item.getAttribute("data-sticker"))).toEqual(collectionFixtures.withTheStickerBook.stickers.map(({ key }) => key));
    const gone = stickers.find((item) => item.getAttribute("data-sticker") === "k:gone")!;
    expect(within(gone).getByText("A teammate")).toBeVisible();
    expect(within(gone).getByText("28 Aug 2026")).toBeVisible();
    expect(within(gone).getByText("Former teammate")).toBeVisible();
    const started = within(left).getByRole("link", { name: /^AI Observability\s?\d/ });
    expect(started.querySelector("[data-crest-art]")).toHaveAttribute("data-crest-art", "missing");
    expect(within(left).getByRole("link", { name: new RegExp(`^${peopleOps.name}\\s?\\d`) }).querySelector("[data-crest-art]")).toHaveAttribute("data-crest-art", "collected");
    const right = page("right");
    expect(within(right).getByRole("heading", { name: /Not started/ })).toBeInTheDocument();
    const untouched = collectionFixtures.withTheStickerBook.albums.find((album) => !album.mine && album.held === 0)!;
    expect(within(right).getByRole("link", { name: new RegExp(`^${untouched.name}\\s?\\d`) })).toHaveAttribute("href", `/book#teams/group:${untouched.group}`);
    expect(within(right).queryByRole("link", { name: new RegExp(`^${peopleOps.name}\\s?\\d`) })).toBeNull();
  });

  it("opens a team as a Panini spread: the crest plate and notes on the left, numbered stickers and printed empty slots on the right, and a Complete stamp once everyone is collected", async () => {
    visit("/book#teams/people-ops");
    const app = showBook(reader, collectionFixtures.withTheStickerBook);
    expect(book()).toHaveAttribute("data-spread", "team");
    expect(book()).toHaveAccessibleName(`${peopleOps.name} album`);
    expect(page("left")).toHaveTextContent(`The ${peopleOps.name} crest is yours.`);
    expect(within(page("right")).getByLabelText("Album complete")).toBeInTheDocument();
    const slots = [...page("right").querySelectorAll<HTMLElement>("[data-slot]")];
    expect(slots.length).toBeGreaterThan(1);
    expect(slots.every((slot) => slot.hasAttribute("data-held"))).toBe(true);
    await app.user.click(within(main()).getByRole("link", { name: /all teams/i }));
    expect(address()).toBe("/book#teams");
    cleanup();
    visit("/book#teams/group:growth");
    showBook(reader, collectionFixtures.withTheStickerBook);
    expect(book()).toHaveAccessibleName("Growth album");
    expect(page("left")).toHaveTextContent("Still to swap thanks with");
    const growth = [...page("right").querySelectorAll<HTMLElement>("[data-slot]")];
    expect(growth.map((slot) => slot.dataset.slot)).toEqual(["k:ben", "k:diego", "k:felix", "k:lina", "k:mei", "k:noor", "k:omar"]);
    expect(growth.filter((slot) => slot.dataset.held === "missing").map((slot) => slot.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Ben Oduya")]));
    expect(within(page("right")).queryByLabelText("Album complete")).toBeNull();
  });

  it("counts albums on the Teams tab while the collection carries albums but no crests, and never calls them crests", () => {
    visit("/book");
    const albumsOnly: Collection = { ...collectionFixtures.collectionWithoutCrests, stickers: collectionFixtures.withTheStickerBook.stickers, albums: collectionFixtures.withTheStickerBook.albums };
    showBook(reader, albumsOnly);
    expect(tab("Teams, 1 of 5 albums")).toHaveTextContent("1/5");
    expect(within(page("right")).getByRole("link", { name: "Teams, 1 of 5 albums" })).toBeInTheDocument();
    expect(book()).not.toHaveTextContent(/crests/);
    expect(pageTabs()).not.toHaveTextContent(/crests/);
  });

  it("falls back to the Teams spread for a team the hash does not name, and says when a group has no one else in it", () => {
    visit("/book#teams/nope");
    showBook(reader, collectionFixtures.withTheStickerBook);
    expect(book()).toHaveAttribute("data-spread", "teams");
    cleanup();
    visit("/book#teams/group:new-starters");
    showBook(reader, collectionFixtures.withTheStickerBook);
    expect(book()).toHaveAccessibleName("New starters album");
    expect(page("right")).toHaveTextContent("No one else in this group yet.");
    expect(page("right").querySelector("[data-slot]")).toBeNull();
  });

  it("hides the Teams tab while the collection carries no crests, stickers or albums", () => {
    visit("/book");
    showBook(reader, collectionFixtures.collectionWithoutCrests);
    expect(within(pageTabs()).getAllByRole("link").map((link) => link.textContent)).toEqual(expect.not.arrayContaining([expect.stringMatching(/^Teams/)]));
    expect(within(page("right")).queryByRole("link", { name: /crests/ })).toBeNull();
  });

  it("goes back to the spread before with the browser's Back", async () => {
    visit("/book");
    const app = showBook(reader);
    await flipTo(/^Hoggies/, app);
    await flipTo(/^Achievements/, app);
    act(() => window.history.back());
    await waitFor(() => expect(book()).toHaveAttribute("data-spread", "hoggies"));
    expect(address()).toBe("/book#hoggies/legendary");
  });

  it("sends a signed-out visitor back to the spread the hash names", async () => {
    visit("/book#hoggies/common");
    const { actions, user } = renderApp(shellFixtures.signedOut);
    expect(screen.getByText(/You'll land on/)).toHaveTextContent("You'll land on /book#hoggies/common afterwards.");
    await user.click(screen.getByRole("button", { name: "Sign in with Slack" }));
    expect(actions.signIn).toHaveBeenCalledWith("/book#hoggies/common");
  });

  it("leaves /book/earned alone: it renders without waiting for the collection", () => {
    visit("/book/earned");
    renderApp(reader, undefined, {}, undefined, fixedBook(theBook), undefined, undefined, undefined, undefined, undefined, undefined, () => undefined);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/earned/);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("shows a broken or denied collection as the page's answer instead of today's Book, and today's Book when the collection is not found", () => {
    visit("/book");
    showBook(reader, { kind: "broken" });
    expect(main().querySelector("[data-spread]")).toBeNull();
    expect(within(main()).queryByRole("link", { name: "Overview" })).toBeNull();
    cleanup();
    visit("/book");
    showBook(reader, collectionFixtures.notFound);
    expect(main().querySelector("[data-spread]")).toBeNull();
    expect(within(main()).getByRole("navigation", { name: "Book pages" })).toHaveTextContent("Overview");
  });

  it("lands /book?crate=bought:2 on its pack once a late collection answers under the spread", async () => {
    visit("/book?crate=bought%3A2");
    let landed = false;
    const shopper = withTheBookSpread(shellFixtures.memberWithTheCrateStore);
    const { showVisitor } = renderApp(shopper, undefined, {}, undefined, fixedBook(theBook), undefined, undefined, undefined, undefined, undefined, undefined, (asking) => (asking && landed ? collectionFixtures.withTheStore : undefined));
    expect(main().querySelector("[data-spread]")).toBeNull();
    landed = true;
    showVisitor({ ...shopper });
    const crates = within(main()).getByRole("region", { name: "Crates" });
    await waitFor(() => expect(crates.querySelector('[data-crate-target="bought:2"] button')).toHaveFocus());
  });

  it("keeps Buy a crate and the pack stack under the book, and ?crate=bought:2 still lands on its pack", async () => {
    visit("/book/collection?crate=bought%3A2");
    const twoWaiting: Collection = collectionFixtures.withTheStore;
    showBook(withTheBookSpread(shellFixtures.memberWithTheCrateStore), twoWaiting);
    const crates = within(main()).getByRole("region", { name: "Crates" });
    expect(book().compareDocumentPosition(crates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(crates).getByRole("button", { name: /Buy a crate/ })).toBeInTheDocument();
    await waitFor(() => expect(crates.querySelector('[data-crate-target="bought:2"] button')).toHaveFocus());
  });

  it("exposes landOnHoggieTile for the pack stack: it flips to the rarity's spread, answers the tile and its coin, and marks it landed", async () => {
    visit("/book");
    showBook(reader);
    const landing = await landOnHoggieTile({ hoggie: "coffee-cup", rarity: "common" });
    expect(address()).toBe("/book#hoggies/common");
    expect(landing?.tile).toBe(tile("coffee-cup"));
    expect(landing?.coin).toHaveAttribute("data-coin", "found");
    markLanded(landing!.tile, 10);
    expect(landing!.tile).toHaveAttribute("data-landed");
    await waitFor(() => expect(landing!.tile).not.toHaveAttribute("data-landed"));
  });

  it("answers null from landOnHoggieTile and leaves the address alone while no spread is open", async () => {
    visit("/book/collection");
    showBook(shellFixtures.memberWithTheBookOpened);
    await expect(landOnHoggieTile({ hoggie: "coffee-cup", rarity: "common" }, { within: 20 })).resolves.toBeNull();
    expect(address()).toBe("/book/collection");
    expect(tile("coffee-cup")).toBeInTheDocument();
  });
});
