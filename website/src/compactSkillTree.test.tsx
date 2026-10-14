import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { shellFixtures, type BuyAnswer, type MemberProfile, type MySkillTree } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "./test/systemTheme";
import { contrast } from "./test/themeContrast";

const atLevel7 = shellFixtures.memberAtLevel7WithOneSkillPoint;

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

function resources() {
  return within(header()).getByRole("list", { name: "Your resources" });
}

function spokenText(element: Element): string {
  return [...element.childNodes]
    .map((child) => (child instanceof Element ? (child.getAttribute("aria-hidden") === "true" ? "" : spokenText(child)) : (child.textContent ?? "")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function chips() {
  return within(resources()).getAllByRole("listitem");
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

function legend() {
  return within(perkTree()).getByRole("list", { name: "Legend" });
}

function yourPerks() {
  return within(main()).getByRole("region", { name: /^Your perks/ });
}

function paintsPrimary(element: Element) {
  return [element, ...element.querySelectorAll("*")].some((part) => /(^|\s)(ring|border|bg|text)-primary(\s|$)/.test(part.getAttribute("class") ?? ""));
}

function showTree(answer: MySkillTree, member: MemberProfile = atLevel7) {
  return renderApp(member, undefined, undefined, undefined, undefined, fixedSkillTree(answer));
}

describe("WS326: the header counts the perks owned and shows the resource chips", () => {
  it.each([
    [skillTreeFixtures.withPoints, "0 of 3 perks owned · 2 skill points to spend"],
    [skillTreeFixtures.sparkOwned, "1 of 3 perks owned · 1 skill point to spend"],
    [skillTreeFixtures.noPointsLeft, "2 of 3 perks owned · No skill points to spend"],
  ])("says {owned} of {total} perks owned, with the total from the read, never E's 14", (answer, line) => {
    showTree(answer);
    expect(within(header()).getByText((_, element) => element?.tagName === "P" && element.textContent === line)).toBeInTheDocument();
    expect(main()).not.toHaveTextContent("of 14");
  });

  it("shows the skill points to spend and LV {n} as chips beside it, the level spoken as Level {n}", () => {
    showTree(skillTreeFixtures.withOnePoint);
    expect(chips().map(spokenText)).toEqual(["1 skill point", "Level 7"]);
    expect(chips()[1]).toHaveTextContent(/^LV\s*Level\s*7$/);
    expect(within(chips()[1]!).getByText("LV")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no level chip while progression is null", () => {
    showTree(skillTreeFixtures.withPoints, shellFixtures.memberWithEveryFeatureOpen);
    expect(chips().map(spokenText)).toEqual(["2 skill points"]);
  });
});

describe("WS327: the legend above the tree", () => {
  it("names Owned, Can buy and Locked, each beside its node look in small, before the first row", () => {
    showTree(skillTreeFixtures.sparkOwned);
    expect(within(legend()).getAllByRole("listitem").map(spokenText)).toEqual(["Owned", "Can buy", "Locked"]);
    expect(legend().compareDocumentPosition(within(perkTree()).getByRole("heading", { name: "Level 5" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(perkTree()).not.toHaveTextContent("Upgraded");
  });
});

describe("WS328: compact square nodes", () => {
  it("shows each perk as a square with its icon, its name as a caption, and its cost as a pill with the skill point glyph while not owned", () => {
    showTree(skillTreeFixtures.noPointsLeft);
    expect(within(nodeOf("Spark")).getByText("Spark")).toBeInTheDocument();
    expect(within(squareOf("Spark")).getByTestId("lock-mark")).toBeInTheDocument();
    expect(within(nodeOf("Spark")).getByTestId("perk-cost")).toHaveTextContent("1");
    expect(within(nodeOf("Spark")).getByTestId("perk-cost").querySelector("svg")).not.toBeNull();
    expect(within(squareOf("Rhythm")).getByTestId("owned-check")).toBeInTheDocument();
    expect(within(nodeOf("Rhythm")).queryByTestId("perk-cost")).toBeNull();
    expect(within(nodeOf("Rhythm")).queryByTestId("lock-mark")).toBeNull();
  });

  it("gives an available node E's strong outline in the foreground colour, with no mark", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(squareOf("Circle")).toHaveClass("border-2", "border-foreground", "bg-card");
    expect(within(squareOf("Circle")).queryByTestId("owned-check")).toBeNull();
    expect(within(squareOf("Circle")).queryByTestId("lock-mark")).toBeNull();
  });

  it("keeps primary on exactly one node, the selection's ring and its Selected tag, while several can be bought (D2, V4)", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(nodes().filter(paintsPrimary)).toEqual([nodeOf("Spark")]);
    expect(squareOf("Spark")).toHaveClass("ring-2", "ring-primary");
    expect(within(nodeOf("Spark")).getByText("Selected")).toBeVisible();
  });

  it("moves the one primary node with the selection", async () => {
    preferWideScreen();
    const { user } = showTree(skillTreeFixtures.withPoints);
    await user.click(nodeOf("Circle"));
    expect(nodes().filter(paintsPrimary)).toEqual([nodeOf("Circle")]);
  });
});

describe("WS329: Your perks counts the active perks", () => {
  it.each([
    ["Your perks · 0 active", skillTreeFixtures.withPoints],
    ["Your perks · 2 active", skillTreeFixtures.noPointsLeft],
  ])("heads the ledger %s and says the perks are permanent and always on", (heading, answer) => {
    showTree(answer);
    expect(within(yourPerks()).getByRole("heading", { level: 2 })).toHaveTextContent(heading);
    expect(yourPerks()).toHaveTextContent("Permanent · always on.");
  });
});

describe("WS330: a one-off purchase pop", () => {
  function buy(answer: BuyAnswer) {
    preferWideScreen();
    const buyPerk = vi.fn(async () => answer);
    const view = renderApp(atLevel7, undefined, { buyPerk }, undefined, undefined, fixedSkillTree(skillTreeFixtures.withPoints));
    return { ...view, buyPerk };
  }

  function popped() {
    return nodes().filter((node) => node.querySelector(".perk-pop") !== null);
  }

  it("pops the bought node once after bought, and no other", async () => {
    const { user } = buy({ kind: "bought" });
    expect(popped()).toEqual([]);
    await user.click(nodeOf("Rhythm"));
    await user.click(within(main()).getByRole("button", { name: /^Buy/ }));
    await act(async () => undefined);
    expect(popped()).toEqual([nodeOf("Rhythm")]);
  });

  it("doesn't pop when the purchase is refused", async () => {
    const { user } = buy({ kind: "refused", reason: "points" });
    await user.click(within(main()).getByRole("button", { name: /^Buy/ }));
    await act(async () => undefined);
    expect(popped()).toEqual([]);
  });

  it("never pops under reduced motion", async () => {
    preferReducedMotion();
    const { user } = buy({ kind: "bought" });
    await user.click(within(main()).getByRole("button", { name: /^Buy/ }));
    await act(async () => undefined);
    expect(popped()).toEqual([]);
  });
});

describe("WS339 V24: the states' outlines, fills and marks meet 3:1 against the card in both modes", () => {
  function tokenPaintsOf(element: Element) {
    const paints = [...element.classList].flatMap((name) => /^(?:bg|border|ring)-((?:muted-)?foreground|border)$/.exec(name)?.[1] ?? []);
    if (paints.length === 0) throw new Error(`<${element.tagName.toLowerCase()} class="${element.className}"> paints with no theme token`);
    return paints;
  }

  function stateGraphics() {
    showTree(skillTreeFixtures.everyState);
    return [
      { part: "the owned fill", element: squareOf("Spark") },
      { part: "the owned check mark", element: within(squareOf("Spark")).getByTestId("owned-check") },
      { part: "the Can buy outline", element: squareOf("Rhythm") },
      { part: "the lock mark", element: within(squareOf("Circle")).getByTestId("lock-mark") },
      ...within(legend()).getAllByTestId("legend-swatch").slice(0, 2).map((element) => ({ part: "the legend's Owned and Can buy swatches", element })),
    ];
  }

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = stateGraphics().flatMap(({ part, element }) => tokenPaintsOf(element).map((paint) => ({ part, paint, ratio: contrast(mode, paint, "card") })));
      expect(measured.length).toBeGreaterThanOrEqual(6);
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});
