// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { navItems, type NavContext } from "../lib/nav";
import { MobileNav, SidebarNav } from "./Nav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const everything: NavContext = { isAdmin: true, isDemo: true, storeEnabled: true, openRequests: 3 };

let root: Root;
let container: HTMLElement;
let url = "";
function LocationProbe() {
  const { pathname, search } = useLocation();
  url = `${pathname}${search}`;
  return null;
}

function renderMobile(path: string, items = navItems(everything)) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <MobileNav items={items} />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** A link's label without its badge. */
function label(el: Element) {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("[data-nav-badge]").forEach((b) => b.remove());
  return clone.textContent;
}
/** What a badge shows, and what it tells a screen reader. */
function badge(el: Element) {
  const b = el.querySelector("[data-nav-badge]");
  return b && { shown: b.querySelector("[aria-hidden]")!.textContent, spoken: b.querySelector(".sr-only")!.textContent };
}
const tabBar = () => container.querySelector<HTMLElement>("nav[aria-label='Main navigation']")!;
const tabLabels = () => [...tabBar().querySelectorAll("a")].map(label);
const moreButton = () => tabBar().querySelector<HTMLButtonElement>("button")!;
const sheet = () => document.querySelector<HTMLElement>("[role='dialog']");
const click = (el: HTMLElement) => act(() => el.click());
const press = (key: string, shiftKey = false) =>
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });

describe("mobile tab bar", () => {
  test("shows four tabs plus More, with the current page marked", () => {
    renderMobile("/leaderboard");
    expect(tabLabels()).toEqual(["Me", "Ranks", "Quests", "Gallery"]);
    expect(label(moreButton())).toBe("More");
    expect(label(tabBar().querySelector("[aria-current='page']")!)).toBe("Ranks");
  });

  test("More carries the badges it hides, for eyes and screen readers", () => {
    renderMobile("/me");
    expect(badge(moreButton())).toEqual({ shown: "3", spoken: "3 open store requests" });
    // Read out as "More, 3 open store requests": the name comes first.
    expect(moreButton().textContent).toMatch(/^More/);
  });

  test("a page from More shows up as the last tab, badge included", () => {
    renderMobile("/admin?tab=store");
    expect(tabLabels()).toEqual(["Me", "Ranks", "Quests", "Admin"]);
    const current = tabBar().querySelector("[aria-current='page']")!;
    expect(label(current)).toBe("Admin");
    expect(badge(current)).toEqual({ shown: "3", spoken: "3 open store requests" });
    expect(current.textContent).toMatch(/^Admin/);
    expect(badge(moreButton())).toBeNull();
  });

  test("with nothing left over there is no More button", () => {
    renderMobile("/me", navItems({ isAdmin: false, isDemo: false, storeEnabled: false, openRequests: 0 }).slice(0, 4));
    expect(tabLabels()).toHaveLength(4);
    expect(tabBar().querySelector("button")).toBeNull();
  });
});

describe("More sheet", () => {
  test("opens as a labelled modal dialog listing the rest by group, and takes focus", () => {
    renderMobile("/me");
    expect(sheet()).toBeNull();
    expect(moreButton().getAttribute("aria-haspopup")).toBe("dialog");
    expect(moreButton().getAttribute("aria-expanded")).toBe("false");

    click(moreButton());

    const dialog = sheet()!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("More");
    expect(moreButton().getAttribute("aria-expanded")).toBe("true");
    expect(moreButton().getAttribute("aria-controls")).toBe(dialog.id);
    expect([...dialog.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["You", "Team", "Workspace"]);
    const links = [...dialog.querySelectorAll("a")];
    expect(links.map(label)).toEqual(["Store", "Compare", "Analytics", "Playground", "Admin"]);
    expect(badge(links[4])).toEqual({ shown: "3", spoken: "3 open store requests" });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test("Escape closes it and gives focus back to More", () => {
    renderMobile("/me");
    click(moreButton());
    press("Escape");
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(moreButton());
    expect(moreButton().getAttribute("aria-expanded")).toBe("false");
  });

  test("Tab and Shift+Tab stay inside the sheet", () => {
    renderMobile("/me");
    click(moreButton());
    const focusables = [...sheet()!.querySelectorAll<HTMLElement>("a, button")];
    const [first, last] = [focusables[0], focusables[focusables.length - 1]];

    act(() => last.focus());
    press("Tab");
    expect(document.activeElement).toBe(first);

    press("Tab", true);
    expect(document.activeElement).toBe(last);
  });

  test("the close button and the backdrop both close it", () => {
    renderMobile("/me");
    click(moreButton());
    click(sheet()!.querySelector<HTMLButtonElement>("button[aria-label='Close']")!);
    expect(sheet()).toBeNull();

    click(moreButton());
    click(document.querySelector<HTMLElement>("[data-sheet-backdrop]")!);
    expect(sheet()).toBeNull();
  });

  test("picking a page navigates, closes the sheet and keeps that page visible as a tab", () => {
    renderMobile("/me");
    click(moreButton());
    click([...sheet()!.querySelectorAll("a")].find((a) => label(a) === "Analytics")!);
    expect(url).toBe("/analytics");
    expect(sheet()).toBeNull();
    expect(tabLabels()).toEqual(["Me", "Ranks", "Quests", "Stats"]);
  });

  test("locks page scrolling while open", () => {
    renderMobile("/me");
    click(moreButton());
    expect(document.body.style.overflow).toBe("hidden");
    press("Escape");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("desktop sidebar", () => {
  test("lists every page under You / Team / Workspace with the admin badge", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/compare"]}>
          <SidebarNav items={navItems(everything)} />
        </MemoryRouter>,
      );
    });
    const nav = container.querySelector("nav")!;
    expect([...nav.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["You", "Team", "Workspace"]);
    expect([...nav.querySelectorAll("a")].map(label)).toEqual([
      "My kudos",
      "Discoveries",
      "Quest log",
      "Store",
      "Leaderboard",
      "Compare",
      "Analytics",
      "Playground",
      "Admin",
    ]);
    expect(badge(nav.querySelector("a[href='/admin?tab=store']")!)).toEqual({ shown: "3", spoken: "3 open store requests" });
    expect(label(nav.querySelector("[aria-current='page']")!)).toBe("Compare");
  });
});
