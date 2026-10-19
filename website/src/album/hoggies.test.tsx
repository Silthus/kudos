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

type Report = { rarity: string; under: boolean };

function watchTheRarityGroups() {
  const watched: { target: Element; callback: IntersectionObserverCallback; watching: boolean }[] = [];
  const lines: string[] = [];
  window.IntersectionObserver = class {
    private readonly mine: typeof watched = [];
    constructor(
      private readonly callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      lines.push(options?.rootMargin ?? "");
    }
    observe(target: Element) {
      const watch = { target, callback: this.callback, watching: true };
      this.mine.push(watch);
      watched.push(watch);
    }
    disconnect() {
      for (const watch of this.mine) watch.watching = false;
    }
  } as unknown as typeof IntersectionObserver;
  return {
    lines,
    report(...reports: Report[]) {
      act(() => {
        for (const { rarity, under } of reports) {
          const group = screen.getByRole("region", { name: rarity });
          for (const watch of watched.filter((each) => each.watching && each.target === group)) watch.callback([{ target: group, isIntersecting: under } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      });
    },
  };
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
  Reflect.deleteProperty(window, "IntersectionObserver");
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

  it("the rarity strip counts each rarity's finds and highlights the rarity under the sticky bar as the page scrolls", async () => {
    const groups = watchTheRarityGroups();
    visit("/book#hoggies");

    const strip = within((await collectionBar()).getByRole("navigation", { name: "Found by rarity" }));
    expect(strip.getAllByRole("button").map((part) => part.getAttribute("aria-label"))).toEqual([
      "Common: 20 of 60 found. Jump there",
      "Uncommon: 14 of 40 found. Jump there",
      "Rare: 10 of 30 found. Jump there",
      "Epic: 5 of 15 found. Jump there",
      "Legendary: 3 of 6 found. Jump there",
    ]);
    const highlighted = () => strip.queryAllByRole("button").filter((part) => part.getAttribute("aria-current") === "location").map((part) => part.textContent);

    groups.report({ rarity: "Common", under: true });
    expect(highlighted()).toEqual(["Common20/60"]);

    groups.report({ rarity: "Common", under: false }, { rarity: "Uncommon", under: true }, { rarity: "Rare", under: true });
    expect(highlighted()).toEqual(["Uncommon14/40"]);

    groups.report({ rarity: "Uncommon", under: false });
    expect(highlighted()).toEqual(["Rare10/30"]);
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

  it("the rarity under the bar is read below the sticky bar, and from the top of the screen once a narrower screen stops the bar sticking", async () => {
    const groups = watchTheRarityGroups();
    visit("/book#hoggies");

    const bar = (await collectionBar()).getByRole("heading", { level: 2, name: "The collection" }).closest<HTMLElement>(".al-hoggies-bar")!;
    expect(groups.lines.at(-1)).toBe("-0px 0px 0px 0px");

    bar.style.position = "sticky";
    bar.style.top = "56px";
    act(() => window.dispatchEvent(new Event("resize")));
    expect(groups.lines.at(-1)).toBe("-56px 0px 0px 0px");

    bar.style.position = "static";
    act(() => window.dispatchEvent(new Event("resize")));
    expect(groups.lines.at(-1)).toBe("-0px 0px 0px 0px");
    groups.report({ rarity: "Rare", under: true });
    expect(screen.getByRole("button", { name: "Rare: 10 of 30 found. Jump there" })).toHaveAttribute("aria-current", "location");
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
