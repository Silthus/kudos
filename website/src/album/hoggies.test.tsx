import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contrast } from "../test/themeContrast";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { HoggiesRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const arrival = 10_000;

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

type Box = { top: number; height: number };

type PageLayout = { bar: { top: number; height: number; sticky: boolean }; groups: Record<string, Box>; pageHeight: number };

const hoggiesCss = readFileSync(join(__dirname, "hoggies.css"), "utf8");

const shellLengths: Record<string, string> = { "--al-top-height": "3.5rem" };

function scrollMarginOfAGroup(collection: HTMLElement) {
  const rule = [...hoggiesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) => selectors!.trim() === ".al-hoggies-group");
  let margin = /scroll-margin-top:\s*([^;]+);/.exec(rule?.[2] ?? "")?.[1] ?? "0px";
  const innermostVar = /var\((--[\w-]+)(?:,\s*([^()]*))?\)/;
  while (innermostVar.test(margin)) margin = margin.replace(innermostVar, (_, name: string, fallback?: string) => collection.style.getPropertyValue(name) || shellLengths[name] || fallback || "0px");
  const terms = margin.replace(/^calc\((.*)\)$/, "$1").split("+");
  return terms.reduce((sum, term) => sum + (term.trim().endsWith("rem") ? Number.parseFloat(term) * 16 : Number.parseFloat(term)), 0);
}

const filteredLineHeight = 30;

const wideLayout: PageLayout = {
  bar: { top: 56, height: 110, sticky: true },
  groups: {
    Common: { top: 1000, height: 1400 },
    Uncommon: { top: 2424, height: 1000 },
    Rare: { top: 3448, height: 700 },
    Epic: { top: 4172, height: 300 },
    Legendary: { top: 4496, height: 250 },
  },
  pageHeight: 4826,
};

const nativeBoxes = Element.prototype.getBoundingClientRect;

function layOutThePage(layout: PageLayout) {
  let scrolled = 0;
  let screenHeight = 900;
  const bottom = () => Math.max(0, layout.pageHeight - screenHeight);
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => screenHeight });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrolled });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => layout.pageHeight });
  const barElement = screen.getByRole("heading", { level: 2, name: "The collection" }).closest<HTMLElement>(".al-hoggies-bar")!;
  const collection = screen.getByRole("region", { name: "The collection" });
  const groupNameOf = (element: Element) => {
    const label = element.getAttribute("aria-labelledby");
    const name = label === null ? null : document.getElementById(label)?.textContent;
    return name !== null && name !== undefined && name in layout.groups ? name : null;
  };
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === barElement) return new DOMRect(0, layout.bar.top, 1000, layout.bar.height + (barElement.textContent?.includes("Showing ") ? filteredLineHeight : 0));
    const name = groupNameOf(this);
    if (name === null) return nativeBoxes.call(this);
    const { top, height } = layout.groups[name]!;
    return new DOMRect(0, top - scrolled, 1000, height);
  };
  const scrollTo = (to: number) => {
    scrolled = Math.min(bottom(), Math.max(0, Math.round(to)));
  };
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this);
    const name = groupNameOf(this);
    if (name === null) return;
    scrollTo(layout.groups[name]!.top - scrollMarginOfAGroup(collection));
    setTimeout(() => window.dispatchEvent(new Event("scroll")));
  };
  const placeTheBar = () => {
    barElement.style.position = layout.bar.sticky ? "sticky" : "static";
    barElement.style.top = `${layout.bar.top}px`;
    act(() => window.dispatchEvent(new Event("resize")));
  };
  placeTheBar();
  return {
    scrollTo(to: number) {
      scrollTo(to);
      act(() => window.dispatchEvent(new Event("scroll")));
    },
    scrollBy(by: number) {
      this.scrollTo(scrolled + by);
    },
    scrolled: () => scrolled,
    resizeTheScreen(height: number) {
      screenHeight = height;
      act(() => window.dispatchEvent(new Event("resize")));
    },
    unstick() {
      layout.bar.sticky = false;
      placeTheBar();
    },
  };
}

async function letTheScrollLand() {
  await act(() => new Promise((landed) => setTimeout(landed, 10)));
}

function markedInTheStrip() {
  return within(screen.getByRole("navigation", { name: "Found by rarity" }))
    .getAllByRole("button")
    .filter((part) => part.getAttribute("aria-current") === "location")
    .map((part) => part.querySelector("strong")?.textContent);
}

function stripPart(rarity: string) {
  return within(screen.getByRole("navigation", { name: "Found by rarity" })).getByRole("button", { name: new RegExp(`^${rarity}:`) });
}

const scrolledTo: Element[] = [];

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  scrolledTo.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = nativeBoxes;
  Reflect.deleteProperty(window, "innerHeight");
  Reflect.deleteProperty(window, "scrollY");
  Reflect.deleteProperty(document.documentElement, "scrollHeight");
});

function visit(path: string, hoggies: HoggiesRead = fixedHoggies(hoggiesFixtures.midway)) {
  window.history.replaceState(null, "", path);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { hoggies });
}

function addressNow() {
  return window.location.pathname + window.location.search + window.location.hash;
}

async function collectionBar() {
  return within(await screen.findByRole("region", { name: "The collection" }, { timeout: arrival }));
}

function platesIn(rarity: string) {
  return within(screen.getByRole("region", { name: rarity }))
    .getAllByRole("button")
    .map((plate) => plate.getAttribute("aria-label"));
}

function plate(name: string) {
  return within(screen.getByRole("region", { name: "The collection" })).getByRole("button", { name });
}

async function entry() {
  return within(await screen.findByRole("dialog", undefined, { timeout: arrival }));
}

describe("AL50: Hoggies is a field guide of the member's hoggies, each with a centred detail", { timeout: 60_000 }, () => {
  it("/book#hoggies opens with the header counting what's found, and the rarest finds lit on a shelf, rarest first and newest first within a rarity", async () => {
    visit("/book#hoggies");

    expect(await screen.findByRole("heading", { level: 1, name: "Hoggies" }, { timeout: arrival })).toBeInTheDocument();
    expect(screen.getByText(/You've found 52 of 151/)).toBeInTheDocument();
    const shelf = within(screen.getByRole("region", { name: "Rarest finds" }));
    expect(shelf.getAllByRole("button").map((find) => find.getAttribute("aria-label"))).toEqual([
      "Final Evolution, Legendary, one copy",
      "Superhero, Legendary, one copy",
      "Wizard, Legendary, one copy",
      "Driving Hogzilla, Epic, one copy",
      "Jack Dawson, Epic, 3 copies",
    ]);
  });

  it("a member with nothing found yet sees an empty shelf that says how it fills", async () => {
    visit("/book#hoggies", fixedHoggies(hoggiesFixtures.newcomer));

    const shelf = within(await screen.findByRole("region", { name: "Rarest finds" }, { timeout: arrival }));
    expect(shelf.queryAllByRole("button")).toEqual([]);
    expect(shelf.getByText("Every thoughtful kudos you give can earn a pack, and every pack rolls one hoggie. Your rarest finds stand here.")).toBeInTheDocument();
  });

  it("the plates are a field guide grouped by rarity in catalogue order: a found hoggie by name with its number and ×n for copies, a hidden one as a silhouette", async () => {
    visit("/book#hoggies");

    await collectionBar();
    expect(platesIn("Common").slice(0, 4)).toEqual(["Asleep, Common, 3 copies", "Not found yet, a common hoggie", "Not found yet, a common hoggie", "Beaker, Common, one copy"]);
    const asleep = plate("Asleep, Common, 3 copies");
    expect(asleep).toHaveTextContent("No. 001");
    expect(asleep).toHaveTextContent("×3");
    expect(asleep.querySelector("img")).toHaveAttribute("alt", "");
    const hidden = screen.getAllByRole("button", { name: "Not found yet, a common hoggie" })[0]!;
    expect(hidden).toHaveTextContent("No. 002");
    expect(hidden).not.toHaveTextContent("Ball");
    expect(hidden.querySelector("[data-silhouette]")).not.toBeNull();
    expect(screen.getAllByRole("region", { name: /^(Common|Uncommon|Rare|Epic|Legendary)$/ }).map((group) => group.querySelector("h3")?.textContent)).toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
  });

  it("the sticky collection bar filters All, Found, Still hidden and Spares with their counts, and each shows only its plates", async () => {
    const { user } = visit("/book#hoggies");

    const bar = await collectionBar();
    const filters = within(bar.getByRole("group", { name: "Show" }));
    expect(filters.getAllByRole("button").map((filter) => [filter.textContent, filter.getAttribute("aria-pressed")])).toEqual([
      ["All151", "true"],
      ["Found52", "false"],
      ["Still hidden99", "false"],
      ["Spares17", "false"],
    ]);

    await user.click(filters.getByRole("button", { name: /^Found/ }));
    expect(filters.getByRole("button", { name: /^Found/ })).toHaveAttribute("aria-pressed", "true");
    expect(platesIn("Legendary")).toEqual(["Final Evolution, Legendary, one copy", "Superhero, Legendary, one copy", "Wizard, Legendary, one copy"]);

    await user.click(filters.getByRole("button", { name: /^Still hidden/ }));
    expect(platesIn("Legendary")).toEqual(["Not found yet, a legendary hoggie", "Not found yet, a legendary hoggie", "Not found yet, a legendary hoggie"]);

    await user.click(filters.getByRole("button", { name: /^Spares/ }));
    expect(screen.queryByRole("region", { name: "Legendary" })).not.toBeInTheDocument();
    expect(platesIn("Common")[0]).toBe("Asleep, Common, 3 copies");
  });

  it("a filter with nothing in it says so", async () => {
    const { user } = visit("/book#hoggies", fixedHoggies(hoggiesFixtures.newcomer));

    const bar = await collectionBar();
    await user.click(bar.getByRole("button", { name: /^Spares/ }));

    expect(screen.getByText("No spares yet. They show up once a pack rolls a hoggie you already have.")).toBeInTheDocument();
  });

  it("the rarity strip counts each rarity's finds and marks the rarity in view as the page scrolls: the group under the sticky bar, and the last one at the page's end", async () => {
    visit("/book#hoggies");

    const strip = within((await collectionBar()).getByRole("navigation", { name: "Found by rarity" }));
    expect(strip.getAllByRole("button").map((part) => part.getAttribute("aria-label"))).toEqual([
      "Common: 20 of 60 found. Jump there",
      "Uncommon: 14 of 40 found. Jump there",
      "Rare: 10 of 30 found. Jump there",
      "Epic: 5 of 15 found. Jump there",
      "Legendary: 3 of 6 found. Jump there",
    ]);
    const page = layOutThePage(structuredClone(wideLayout));

    page.scrollTo(0);
    expect(markedInTheStrip(), "the collection still below the bar starts at Common").toEqual(["Common"]);

    page.scrollTo(2424 - 166 - 10);
    expect(markedInTheStrip(), "Uncommon's top still 10 px below the bar, with Common's end already under it").toEqual(["Uncommon"]);

    page.scrollTo(2424 - 166 - 30);
    expect(markedInTheStrip(), "Common's last 6 px still below the bar").toEqual(["Common"]);

    page.scrollTo(3448 - 166 + 200);
    expect(markedInTheStrip(), "200 px into Rare").toEqual(["Rare"]);

    page.scrollTo(4826);
    expect(markedInTheStrip(), "at the page's end, where the short Legendary group can never reach the bar").toEqual(["Legendary"]);

    page.scrollBy(-20);
    expect(markedInTheStrip(), "20 px above the page's end the bar is over Rare's end again").toEqual(["Rare"]);

    page.scrollTo(4826);
    expect(markedInTheStrip()).toEqual(["Legendary"]);
    page.resizeTheScreen(700);
    expect(markedInTheStrip(), "a shorter screen at the same scroll is no longer at the page's end").toEqual(["Rare"]);
  });

  it("a picked rarity is marked at once and stays marked when the scroll lands, for every rarity, the short ones at the page's end too", async () => {
    const { user } = visit("/book#hoggies");

    await collectionBar();
    const page = layOutThePage(structuredClone(wideLayout));

    for (const rarity of ["Uncommon", "Common", "Rare", "Epic", "Legendary"]) {
      await user.click(stripPart(rarity));
      expect(markedInTheStrip(), `${rarity} right after the click`).toEqual([rarity]);
      await letTheScrollLand();
      expect(markedInTheStrip(), `${rarity} once the scroll lands`).toEqual([rarity]);
    }

    await user.click(stripPart("Uncommon"));
    await letTheScrollLand();
    expect(page.scrolled(), "Uncommon lands 0.75rem under the sticky bar").toBe(2424 - 166 - 12);
    page.scrollBy(10);
    expect(markedInTheStrip(), "a nudge after landing on Uncommon").toEqual(["Uncommon"]);

    await user.click(stripPart("Epic"));
    await letTheScrollLand();
    expect(page.scrolled(), "Epic is too near the end to reach the bar").toBe(4826 - 900);
    expect(markedInTheStrip(), "Epic stays marked at the page's end").toEqual(["Epic"]);
    page.scrollBy(-200);
    expect(markedInTheStrip(), "scrolling away hands the mark back to the rarity in view").toEqual(["Rare"]);
  });

  it("a pick ends when a filter changes the groups, even with the page where it was", async () => {
    const { user } = visit("/book#hoggies");

    const bar = await collectionBar();
    layOutThePage(structuredClone(wideLayout));
    await user.click(stripPart("Legendary"));
    await letTheScrollLand();
    expect(markedInTheStrip()).toEqual(["Legendary"]);

    await user.click(bar.getByRole("button", { name: /^Spares/ }));

    expect(screen.queryByRole("region", { name: "Legendary" })).not.toBeInTheDocument();
    const lastShown = screen.getAllByRole("region", { name: /^(Common|Uncommon|Rare|Epic)$/ }).at(-1)!.querySelector("h3")!.textContent;
    expect(markedInTheStrip(), "the page's end now holds the last group Spares keeps").toEqual([lastShown]);
  });

  it("jumping out of a landed rarity lands under the bar as it is once the landed line goes", async () => {
    const { user } = visit("/book#hoggies/rare");

    expect(await screen.findByText("Showing rare hoggies.", undefined, { timeout: arrival })).toBeInTheDocument();
    const page = layOutThePage(structuredClone(wideLayout));

    await user.click(stripPart("Uncommon"));
    await letTheScrollLand();

    expect(screen.queryByText("Showing rare hoggies.")).not.toBeInTheDocument();
    expect(page.scrolled(), "Uncommon lands 0.75rem under the bar without its Showing line").toBe(2424 - 166 - 12);
    page.scrollBy(2);
    expect(markedInTheStrip()).toEqual(["Uncommon"]);
  });

  it("a rarity in the strip jumps to its group, showing every hoggie again when the filter hid that rarity", async () => {
    const { user } = visit("/book#hoggies");

    const bar = await collectionBar();
    await user.click(bar.getByRole("button", { name: /^Spares/ }));
    await user.click(bar.getByRole("button", { name: "Legendary: 3 of 6 found. Jump there" }));

    expect(bar.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(scrolledTo).toContain(screen.getByRole("region", { name: "Legendary" })));
  });

  it("an old link to a rarity lands filtered to it, marked in the strip, and Show every rarity clears the filter in place", async () => {
    const { user } = visit("/book#hoggies/epic");

    expect(await screen.findByText("Showing epic hoggies.", undefined, { timeout: arrival })).toBeInTheDocument();
    await waitFor(() => expect(addressNow()).toBe("/book#hoggies"));
    expect(screen.getAllByRole("region", { name: /^(Common|Uncommon|Rare|Epic|Legendary)$/ }).map((group) => group.querySelector("h3")?.textContent)).toEqual(["Epic"]);
    expect(screen.getByRole("button", { name: "Epic: 5 of 15 found. Jump there" })).toHaveAttribute("aria-current", "location");

    await user.click(screen.getByRole("button", { name: "Show every rarity" }));

    expect(screen.queryByText("Showing epic hoggies.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /^(Common|Uncommon|Rare|Epic|Legendary)$/ })).toHaveLength(5);
    expect(screen.getByRole("heading", { level: 2, name: "The collection" })).toHaveFocus();
  });

  it("a rarity is read and landed below the sticky bar, and below the top bar once a narrower screen stops the bar sticking", async () => {
    const { user } = visit("/book#hoggies");

    await collectionBar();
    const page = layOutThePage(structuredClone(wideLayout));

    await user.click(stripPart("Rare"));
    await letTheScrollLand();
    expect(page.scrolled(), "Rare lands 0.75rem under the stuck bar").toBe(3448 - 56 - 110 - 12);

    page.unstick();
    await user.click(stripPart("Uncommon"));
    await letTheScrollLand();
    expect(page.scrolled(), "Uncommon lands 0.75rem under the top bar").toBe(2424 - 56 - 12);
    page.scrollBy(-30);
    expect(markedInTheStrip(), "30 px above Uncommon, Common's end is under the top bar").toEqual(["Common"]);
  });

  it("Back and Forward to a landed rarity mark that rarity, and the rarity in view again once every rarity shows", async () => {
    visit("/book#hoggies");

    await collectionBar();
    const page = layOutThePage(structuredClone(wideLayout));
    page.scrollTo(2424 - 166 + 100);
    expect(markedInTheStrip()).toEqual(["Uncommon"]);

    act(() => {
      window.history.pushState(null, "", "/book#hoggies/epic");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByText("Showing epic hoggies.")).toBeInTheDocument();
    expect(markedInTheStrip(), "Forward to the landed rarity").toEqual(["Epic"]);

    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByText("Showing epic hoggies.")).not.toBeInTheDocument());
    await waitFor(() => expect(markedInTheStrip(), "Back to every rarity").toEqual(["Uncommon"]));
  });

  it("waits on its own read and shows the album's loading page meanwhile", async () => {
    visit("/book#hoggies", () => undefined);

    expect(await screen.findByRole("navigation", { name: "Album" }, { timeout: arrival })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading", { level: 1, name: "Hoggies" })).not.toBeInTheDocument();
  });

  it("a plate opens its detail in the address, with its number, rarity, first find, copies and odds, and Escape closes it back onto the plate", async () => {
    const { user } = visit("/book#hoggies");

    await collectionBar();
    const asleep = plate("Asleep, Common, 3 copies");
    await user.click(asleep);

    const shown = await entry();
    expect(addressNow()).toBe("/book#hoggies/asleep");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Asleep");
    expect(shown.getByText("No. 001")).toBeInTheDocument();
    expect(shown.getByText("Common")).toBeInTheDocument();
    expect(shown.getByText("First found").nextSibling).toHaveTextContent("18 Oct 2026");
    expect(shown.getByText("Copies").nextSibling).toHaveTextContent("3 copies");
    expect(shown.getByText("Odds").nextSibling).toHaveTextContent("About 1 in 120 rolls");
    expect(shown.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1, name: "Hoggies" })).not.toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(addressNow()).toBe("/book#hoggies"));
    expect(asleep).toHaveFocus();
  });

  it("the arrow keys step to the previous and next plate the page shows, wrapping at the ends and keeping the one history entry", async () => {
    const { user } = visit("/book#hoggies");

    await collectionBar();
    await user.click(plate("Asleep, Common, 3 copies"));
    await entry();
    const entries = window.history.length;

    await user.keyboard("{ArrowRight}");
    expect(addressNow()).toBe("/book#hoggies/ball");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Not found yet");
    expect(within(screen.getByRole("dialog")).getByText("2 of 151")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(addressNow()).toBe("/book#hoggies/wizard");
    expect(within(screen.getByRole("dialog")).getByText("151 of 151")).toBeInTheDocument();
    expect(window.history.length).toBe(entries);
  });

  it("Previous and Next step through the filtered plates only, and Tab stays inside the detail", async () => {
    const { user } = visit("/book#hoggies");

    const bar = await collectionBar();
    await user.click(bar.getByRole("button", { name: /^Found/ }));
    await user.click(plate("Beaker, Common, one copy"));
    const shown = await entry();

    await user.click(shown.getByRole("button", { name: "Previous" }));
    expect(addressNow()).toBe("/book#hoggies/asleep");
    expect(shown.getByText("1 of 52")).toBeInTheDocument();
    await user.click(shown.getByRole("button", { name: "Next" }));
    await user.click(shown.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^(?!Not found yet)/);
    expect(shown.getByText("3 of 52")).toBeInTheDocument();

    shown.getByRole("button", { name: "Next" }).focus();
    await user.tab();
    expect(shown.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("a hoggie opened from the shelf under a rarity it isn't in steps through the plates shown, and closing returns focus to the shelf", async () => {
    const { user } = visit("/book#hoggies/epic");

    const shelf = within(await screen.findByRole("region", { name: "Rarest finds" }, { timeout: arrival }));
    const wizard = shelf.getByRole("button", { name: "Wizard, Legendary, one copy" });
    await user.click(wizard);
    expect((await entry()).getByText("16 of 16")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(wizard).toHaveFocus();

    await user.click(wizard);
    const shown = await entry();
    await user.keyboard("{ArrowLeft}");
    expect(shown.getByText("15 of 15")).toBeInTheDocument();
    expect(shown.getByText("Epic")).toBeInTheDocument();
    const steppedTo = addressNow().replace("/book#hoggies/", "");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toHaveAttribute("data-hoggie", steppedTo);
  });

  it("a hidden hoggie's detail keeps its name secret and tells how to find one", async () => {
    visit("/book#hoggies/ball");

    const shown = await entry();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Not found yet");
    expect(shown.queryByText("Ball")).not.toBeInTheDocument();
    expect(shown.getByText("Still out there. Every thoughtful kudos you give can earn a pack, and every pack rolls one hoggie.")).toBeInTheDocument();
    expect(shown.queryByText("First found")).not.toBeInTheDocument();
  });

  it("an address naming a hoggie opens its detail straight away, and closing it stays on the page", async () => {
    const { user } = visit("/book#hoggies/wizard");

    await entry();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Wizard");

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(addressNow()).toBe("/book#hoggies");
    expect(plate("Wizard, Legendary, one copy")).toHaveFocus();
  });

  it("the browser's Back closes a detail opened from a plate", async () => {
    const { user } = visit("/book#hoggies");

    await collectionBar();
    await user.click(plate("Wizard, Legendary, one copy"));
    await entry();

    act(() => window.history.back());

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(addressNow()).toBe("/book#hoggies");
  });

  it("an unknown hoggie opens no detail", async () => {
    visit("/book#hoggies/no-such-hoggie");

    expect(await screen.findByRole("heading", { level: 1, name: "Hoggies" }, { timeout: arrival })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AL55: the hoggie page's rarity words meet 4.5:1 on its surfaces in both themes", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = ["common", "uncommon", "rare", "epic", "legendary"].flatMap((rarity) => ["card", "background", "muted"].map((surface) => ({ rarity, surface, ratio: contrast(mode, `al-ink-${rarity}`, surface) })));
      expect(measured.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
    });
  }
});
