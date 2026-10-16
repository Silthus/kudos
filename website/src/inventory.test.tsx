import { fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";
import { contrast, type Mode } from "./test/themeContrast";

const { memberWithTheInventory, memberWithCustomEmoji, memberWithCoinsBeforeTheStore, memberWithTheBoard } = shellFixtures;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function inventory() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Inventory" });
}

function queryInventory() {
  return within(screen.getByRole("main")).queryByRole("region", { name: "Inventory" });
}

function kudosEmoji() {
  return within(inventory()).getByRole("region", { name: "Kudos emoji" });
}

function readAloudIn(list: HTMLElement) {
  return within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const spoken = item.cloneNode(true) as HTMLElement;
      for (const hidden of spoken.querySelectorAll("[aria-hidden='true']")) hidden.remove();
      return spoken.textContent;
    });
}

function glyphsIn(list: HTMLElement) {
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("[aria-hidden='true']")?.textContent);
}

function follows(before: Element, after: Element) {
  return (before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function coinsChip() {
  return within(screen.getByRole("banner")).queryByTitle(/coins/);
}

describe("ST8 ST26: the gear panel shows the owned kudos emoji", () => {
  it("is the inventory alone, with no side toggle and no button on an owned emoji, and says every owned emoji counts", () => {
    renderApp(memberWithTheInventory);

    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Character" })).not.toBeInTheDocument();
    expect(kudosEmoji()).toHaveTextContent("Each of your kudos emoji counts as a kudos, like :taco:.");
    const yours = within(kudosEmoji()).getByRole("list", { name: "Yours" });
    expect(within(yours).queryAllByRole("button")).toEqual([]);
    expect(readAloudIn(yours)).toEqual(["Hedgehog", "Rocket", "Sunflower"]);
  });
});

describe("ST32: with nothing on sale, the store says so as App Home does", () => {
  const { memberWithNothingForSale, memberWithOneEmojiForSale } = shellFixtures;
  const nothingForSale = "Nothing for sale right now.";

  it("says Nothing for sale right now. below what isn't yours yet", () => {
    renderApp(memberWithNothingForSale);

    const notYet = within(kudosEmoji()).getByRole("list", { name: "Not yours yet" });
    expect(readAloudIn(notYet)).toEqual(["RibbonSilver in Generosity"]);
    expect(follows(notYet, within(kudosEmoji()).getByText(nothingForSale))).toBe(true);
  });

  it("says nothing of the kind while a custom emoji is on sale", () => {
    renderApp(memberWithOneEmojiForSale);

    expect(within(kudosEmoji()).getByRole("button", { name: "Buy for 100 coins, :shipit:" })).toBeInTheDocument();
    expect(kudosEmoji()).not.toHaveTextContent(nothingForSale);
  });

  it.each([false, true])("passes axe with dark mode %s", async (dark) => {
    fakeSystemTheme(dark);
    renderApp(memberWithNothingForSale);

    const results = await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations).toEqual([]);
  });
});

describe("WS341 ST26: the inventory side of the home's main slot, read only", () => {
  it("holds the kudos emoji section with the owned items and the balance", () => {
    renderApp(memberWithTheInventory);

    expect(inventory()).toHaveTextContent("236 coins");
    expect(within(kudosEmoji()).getByRole("heading", { level: 3, name: "Kudos emoji" })).toBeInTheDocument();
    expect(glyphsIn(within(kudosEmoji()).getByRole("list", { name: "Yours" }))).toEqual(["🦔", "🚀", "🌻"]);
  });

  it("lists what isn't yours yet with Buy for its price in coins or the silver tier that gives it", () => {
    renderApp(memberWithTheInventory);

    const notYet = within(kudosEmoji()).getByRole("list", { name: "Not yours yet" });
    expect(readAloudIn(notYet)).toEqual(["Glowing StarBuy for 100 coins, Glowing Star", "GemBuy for 100 coins, Gem", "RibbonSilver in Generosity"]);
    expect(glyphsIn(notYet)).toEqual(["🌟", "💎", "🎀"]);
  });

  it("has no hedgehog section until hedgehogs ship", () => {
    renderApp(memberWithTheInventory);

    expect(within(inventory()).queryByRole("heading", { name: "Hedgehogs" })).not.toBeInTheDocument();
  });

  it.each([
    ["the store is hidden", memberWithCoinsBeforeTheStore],
    ["coins are hidden", shellFixtures.memberWithEveryFeatureOpen],
  ])("isn't there while %s", (_, member: MemberProfile) => {
    renderApp(member);

    expect(queryInventory()).not.toBeInTheDocument();
  });

  it.each([false, true])("passes axe with dark mode %s", async (dark) => {
    fakeSystemTheme(dark);
    renderApp(memberWithTheInventory);

    const results = await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations).toEqual([]);
  });
});

describe("WS303 WS341 CO26: the coins chip in the HUD", () => {
  it("sits after the skill point chip with the balance, named and explained by its tooltip", () => {
    renderApp({ ...memberWithTheInventory, skillPoints: 2 });

    const banner = within(screen.getByRole("banner"));
    const chip = coinsChip()!;
    expect(chip).toHaveTextContent("236");
    expect(chip).toHaveAccessibleName("236 coins to spend");
    expect(chip).toHaveAttribute("title", "236 coins to spend");
    expect(follows(banner.getByRole("link", { name: "2 skill points to spend" }), chip)).toBe(true);
    expect(follows(chip, banner.getByRole("link", { name: "Sam Example, level 6" }))).toBe(true);
  });

  it("follows walletOf: there with Coins open before the store, gone while coins are hidden", () => {
    const { showVisitor } = renderApp(memberWithCoinsBeforeTheStore);
    expect(coinsChip()).toHaveAccessibleName("40 coins to spend");

    showVisitor({ ...memberWithCoinsBeforeTheStore, coins: null });

    expect(coinsChip()).not.toBeInTheDocument();
  });
});

describe("WS322: how it counts names coins once they show", () => {
  function howItCounts(member: MemberProfile) {
    window.history.replaceState(null, "", "/leaderboard");
    renderApp(member, fixedLeaderboard(leaderboardFixtures.midBoard));
    return within(screen.getByRole("main")).getByRole("region", { name: "How it counts" });
  }

  it("adds coins to what never ranks anyone while the member's coins show", () => {
    expect(howItCounts({ ...memberWithTheBoard, coins: 12 })).toHaveTextContent("Only kudos given count. Kudos received, XP, levels, coins and achievements never rank anyone.");
  });

  it("names no coins while they're hidden", () => {
    expect(howItCounts(memberWithTheBoard)).toHaveTextContent("Only kudos given count. Kudos received, XP, levels and achievements never rank anyone.");
  });
});

describe("WS339 V24: the coin glyph stays readable", () => {
  function tokenOf(element: Element, prefix: "bg" | "text") {
    const tokens = [...element.classList].flatMap((name) => new RegExp(`^${prefix}-([a-z-]+)$`).exec(name)?.[1] ?? []).filter((token) => !/^(xs|sm|lg|\[)/.test(token));
    expect(tokens, `one ${prefix} colour on ${element.tagName}`).toHaveLength(1);
    return tokens[0]!;
  }

  describe.each<Mode>(["light", "dark"])("in %s mode", (mode) => {
    it("draws the coin glyph at 3:1 on the panel", () => {
      renderApp(memberWithTheInventory);
      expect(contrast(mode, tokenOf(within(inventory()).getAllByTestId("coin-glyph")[0]!, "text"), "card")).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("WS341 ST36: a custom kudos emoji shows its Slack picture, and its name when the picture fails", () => {
  function itemNamed(list: "Yours" | "Not yours yet", name: string) {
    const items = within(within(kudosEmoji()).getByRole("list", { name: list })).getAllByRole("listitem");
    return items.find((item) => item.textContent?.includes(name))!;
  }

  it("draws an owned and a for-sale custom emoji as their pictures, named by their names", () => {
    renderApp(memberWithCustomEmoji);

    const owned = itemNamed("Yours", ":partyparrot:");
    expect(owned.querySelector("img")).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/partyparrot/a1b2.png");
    expect(owned.querySelector("img")).toHaveAttribute("alt", ":partyparrot:");
    expect(within(owned).queryByRole("img")).toBeNull();
    expect(within(within(kudosEmoji()).getByRole("list", { name: "Yours" })).queryAllByRole("button")).toEqual([]);
    expect(itemNamed("Not yours yet", ":shipit:").querySelector("img")).toHaveAttribute("alt", ":shipit:");
  });

  it("dims a for-sale picture but never its fallback name, which stays inside its row", () => {
    renderApp(memberWithCustomEmoji);

    const forSale = itemNamed("Not yours yet", ":shipit:");
    expect(forSale.querySelector("img")).toHaveClass("opacity-60");
    fireEvent.error(forSale.querySelector("img")!);

    const fallback = forSale.querySelector("[data-custom-emoji]")!;
    expect(fallback.closest("[class*='opacity-']")).toBeNull();
    expect(fallback).toHaveClass("truncate", "max-w-full");
    expect(fallback.parentElement!.parentElement).toHaveClass("max-w-24");
  });

  it("shows the name chip in the picture's place once the picture fails to load", () => {
    renderApp(memberWithCustomEmoji);

    const owned = itemNamed("Yours", ":partyparrot:");
    fireEvent.error(owned.querySelector("img")!);

    expect(owned.querySelector("img")).toBeNull();
    expect(owned.querySelector("[data-custom-emoji]")).toHaveTextContent(":partyparrot:");
    expect(within(within(kudosEmoji()).getByRole("list", { name: "Yours" })).queryAllByRole("button")).toEqual([]);
  });

  it.each([false, true])("passes axe with dark mode %s", async (dark) => {
    fakeSystemTheme(dark);
    renderApp(memberWithCustomEmoji);

    const results = await axe.run(inventory(), { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations).toEqual([]);
  });
});
