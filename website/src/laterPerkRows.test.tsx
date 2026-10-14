import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { shellFixtures, type MySkillTree } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";
import { contrast } from "./test/themeContrast";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/skills");
});

function main() {
  return screen.getByRole("main");
}

function header() {
  return screen.getByRole("heading", { level: 1 }).closest("header")!;
}

function spokenText(element: Element): string {
  return [...element.childNodes]
    .map((child) => (child instanceof Element ? (child.getAttribute("aria-hidden") === "true" ? "" : spokenText(child)) : (child.textContent ?? "")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function chips() {
  return within(within(header()).getByRole("list", { name: "Your resources" })).getAllByRole("listitem");
}

function perkTree() {
  return within(main()).getByRole("region", { name: "Perk tree" });
}

function nodes() {
  return within(perkTree()).getAllByRole("button");
}

function nodeOf(name: string) {
  return within(perkTree()).getByRole("button", { name: new RegExp(`^${name}\\.`) });
}

function squareOf(name: string) {
  return within(nodeOf(name)).getByTestId("perk-square");
}

function cellOf(name: string) {
  return nodeOf(name).closest("li")!;
}

function connectorUnder(name: string) {
  return within(cellOf(name)).getByTestId("upgrade-connector");
}

function legend() {
  return within(perkTree()).getByRole("list", { name: "Legend" });
}

function yourPerks() {
  return within(main()).getByRole("region", { name: /^Your perks/ });
}

function details() {
  return within(main()).getByRole("region", { name: "Perk details" });
}

function showTree(answer: MySkillTree) {
  return renderApp(shellFixtures.memberAtLevel7WithOneSkillPoint, undefined, undefined, undefined, undefined, fixedSkillTree(answer));
}

describe("WS345: every row the read lists, each upgrade under the perk it replaces", () => {
  it("draws one band per row, Level 5, 7 and 9, with every perk of the read as a node", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(within(perkTree()).getAllByRole("heading", { level: 3 }).map(({ textContent }) => textContent)).toEqual(["Level 5", "Level 7", "Level 9"]);
    expect(nodes()).toHaveLength(8);
    expect(within(header()).getByText((_, element) => element?.tagName === "P" && element.textContent === "3 of 8 perks owned · 3 skill points to spend")).toBeInTheDocument();
  });

  it("puts each upgrade in its base's column, and a perk that upgrades nothing in the next free one", () => {
    showTree(skillTreeFixtures.everyRow);
    const columnOf = (name: string) => cellOf(name).style.gridColumnStart;
    expect(["Spark", "Rhythm", "Circle"].map(columnOf)).toEqual(["1", "2", "3"]);
    expect(["Flame", "Cadence", "Bridge", "Treasurer"].map(columnOf)).toEqual(["1", "2", "3", "4"]);
    expect(columnOf("Banker")).toBe(columnOf("Treasurer"));
  });

  it("joins each base to its upgrade with a connector: solid once both are owned, dashed while the upgrade isn't", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(within(perkTree()).getAllByTestId("upgrade-connector")).toHaveLength(4);
    expect(connectorUnder("Spark")).toHaveClass("border-solid", "border-foreground");
    expect(connectorUnder("Rhythm")).toHaveClass("border-dashed", "border-foreground");
    expect(connectorUnder("Circle")).toHaveClass("border-dashed", "border-muted-foreground");
    expect(connectorUnder("Treasurer")).toHaveClass("border-dashed", "border-muted-foreground");
    expect(connectorUnder("Spark")).toHaveAttribute("aria-hidden", "true");
    expect(within(cellOf("Banker")).queryByTestId("upgrade-connector")).toBeNull();
  });

  it("shows a replaced base as Upgraded, captioned with the upgrade that took it over, and says so", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(nodeOf("Spark")).toHaveAccessibleName("Spark. Upgraded to Flame.");
    expect(within(nodeOf("Spark")).getByTestId("upgraded-to")).toHaveTextContent("Flame");
    expect(squareOf("Spark")).toHaveClass("border-dashed", "bg-card");
    expect(within(squareOf("Spark")).queryByTestId("owned-check")).toBeNull();
    expect(within(nodeOf("Spark")).queryByTestId("perk-cost")).toBeNull();
  });

  it("marks an owned upgrade with its base's glyph and names the base it replaced", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(nodeOf("Flame")).toHaveAccessibleName("Flame. Owned. Upgraded from Spark.");
    expect(within(squareOf("Flame")).getByTestId("owned-check")).toBeInTheDocument();
    expect(within(squareOf("Flame")).getByTestId("upgraded-from")).toBeInTheDocument();
  });

  it("shows coin costs beside skill points in the pill and the node's name, and no coins for a perk without a price", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(within(nodeOf("Cadence")).getByTestId("perk-cost")).toHaveTextContent(/^1\s*200$/);
    expect(within(nodeOf("Cadence")).getByTestId("perk-cost").querySelectorAll("svg")).toHaveLength(2);
    expect(nodeOf("Cadence")).toHaveAccessibleName("Cadence. Can buy. Costs 1 skill point and 200 coins.");
    expect(within(nodeOf("Treasurer")).getByTestId("perk-cost")).toHaveTextContent(/^1$/);
    expect(nodeOf("Treasurer")).toHaveAccessibleName("Treasurer. Can buy. Costs 1 skill point.");
    expect(nodeOf("Banker")).toHaveAccessibleName("Banker. Needs Treasurer first. Costs 2 skill points and 250 coins.");
  });

  it("names an upgrade the member can't pay for in coins", () => {
    showTree(skillTreeFixtures.tooFewCoins);
    expect(nodeOf("Flame")).toHaveAccessibleName("Flame. Not enough coins. Costs 1 skill point and 150 coins.");
    expect(within(squareOf("Flame")).getByTestId("lock-mark")).toBeInTheDocument();
  });
});

describe("WS327 WS345: Upgraded joins the legend with the upgrades", () => {
  it("names Owned, Can buy, Upgraded and Locked while the tree has an upgrade", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(within(legend()).getAllByRole("listitem").map(spokenText)).toEqual(["Owned", "Can buy", "Upgraded", "Locked"]);
  });
});

describe("WS326: the coins chip joins the header with coins", () => {
  it("shows the wallet's coins between the skill points and the level while the read carries them", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(chips().map(spokenText)).toEqual(["3 skill points", "180 coins", "Level 7"]);
  });

  it("shows no coins chip while the read carries no wallet", () => {
    showTree(skillTreeFixtures.coinPerkOwnedWhileCoinsHidden);
    expect(chips().map(spokenText)).toEqual(["1 skill point", "Level 7"]);
  });
});

describe("WS345: an upgrade's details", () => {
  it("gives the cost in skill points and coins, the perk it upgrades, and Buy for both", async () => {
    preferWideScreen();
    const { user } = showTree(skillTreeFixtures.everyRow);
    await user.click(nodeOf("Cadence"));
    expect(within(details()).getByText("Cost").nextElementSibling).toHaveTextContent("1 skill point and 200 coins");
    expect(within(details()).getByText("Upgrades").nextElementSibling).toHaveTextContent("Rhythm");
    expect(within(details()).getByRole("button", { name: "Buy for 1 skill point and 200 coins" })).toBeInTheDocument();
    expect(details()).toHaveTextContent("Spent skill points and coins never come back.");
  });

  it("says the upgrade took a replaced base over", async () => {
    preferWideScreen();
    const { user } = showTree(skillTreeFixtures.everyRow);
    await user.click(nodeOf("Spark"));
    expect(details()).toHaveTextContent("Flame took over this perk. Its stronger effect is the one that counts now.");
    expect(within(details()).queryByRole("button", { name: /^Buy/ })).toBeNull();
  });
});

describe("WS345: the upgrade-aware ledger", () => {
  it("lists one entry per chain: the upgrade with the base it replaced, never the base on its own", () => {
    showTree(skillTreeFixtures.everyRow);
    expect(within(yourPerks()).getByRole("heading", { level: 2 })).toHaveTextContent("Your perks · 2 active");
    expect(within(yourPerks()).getAllByRole("heading", { level: 3 }).map(({ textContent }) => textContent)).toEqual(["Rhythm", "Flame"]);
    expect(within(yourPerks()).getByRole("heading", { name: "Flame" }).closest("li")).toHaveTextContent("Upgraded from Spark");
  });
});

describe("an owned coin perk whose copy is hidden with coins", () => {
  function emptyParagraphs() {
    return [...document.querySelectorAll("p")].filter(({ textContent }) => textContent === "");
  }

  it("draws no empty line in the ledger or the details", async () => {
    preferWideScreen();
    const { user } = showTree(skillTreeFixtures.coinPerkOwnedWhileCoinsHidden);
    await user.click(nodeOf("Treasurer"));
    expect(within(yourPerks()).getByRole("heading", { name: "Treasurer" })).toBeInTheDocument();
    expect(emptyParagraphs().filter((paragraph) => paragraph.getAttribute("role") !== "status")).toEqual([]);
  });

  it("gives the drawer no empty description", async () => {
    const { user } = showTree(skillTreeFixtures.coinPerkOwnedWhileCoinsHidden);
    await user.click(nodeOf("Treasurer"));
    const drawer = await screen.findByRole("dialog");
    expect(drawer).not.toHaveAttribute("aria-describedby");
    expect(emptyParagraphs().filter((paragraph) => paragraph.getAttribute("role") !== "status")).toEqual([]);
  });
});

describe("WS339 V24: the upgrade looks meet 3:1 against the card in both modes", () => {
  function tokenPaintsOf(element: Element) {
    const paints = [...element.classList].flatMap((name) => /^(?:bg|border|ring|text)-((?:muted-)?foreground|border|warning-foreground|completed-foreground)$/.exec(name)?.[1] ?? []);
    if (paints.length === 0) throw new Error(`<${element.tagName.toLowerCase()} class="${element.className}"> paints with no theme token`);
    return paints;
  }

  function upgradeGraphics() {
    showTree(skillTreeFixtures.everyRow);
    return [
      { part: "the Upgraded outline", element: squareOf("Spark") },
      { part: "the upgraded-from badge", element: within(squareOf("Flame")).getByTestId("upgraded-from") },
      ...within(perkTree()).getAllByTestId("upgrade-connector").map((element) => ({ part: "the connectors", element })),
      ...within(perkTree()).getAllByTestId("coin-glyph").map((element) => ({ part: "the coin glyph", element })),
      ...within(legend()).getAllByTestId("legend-swatch").map((element) => ({ part: "the legend's swatches", element })),
    ];
  }

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = upgradeGraphics().flatMap(({ part, element }) => tokenPaintsOf(element).map((paint) => ({ part, paint, ratio: contrast(mode, paint, "card") })));
      expect(measured.length).toBeGreaterThanOrEqual(10);
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});
