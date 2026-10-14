import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { shellFixtures, type CommandAnswer, type MemberProfile, type MySkillTree } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const withTheTree = shellFixtures.memberWithEveryFeatureOpen;

const howPerksWork =
  "Perks give bonus XP when you thank someone and say why. Bonuses count when your message has 5 or more words besides mentions and emoji. Every level from 5 on gives one skill point. A spent skill point never comes back, and there's no respec.";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/skills");
});

function main() {
  return screen.getByRole("main");
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function perkTree() {
  return within(main()).getByRole("region", { name: "Perk tree" });
}

function nodeOf(name: string) {
  return within(perkTree()).getByRole("button", { name: new RegExp(`^${name}\\.`) });
}

function nodes() {
  return within(perkTree()).getAllByRole("button");
}

function details() {
  return within(main()).getByRole("region", { name: "Perk details" });
}

function screenNav() {
  return within(screen.getByRole("navigation", { name: "Screens" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function drawer() {
  return screen.queryByRole("dialog");
}

function yourPerks() {
  return within(main()).getByRole("region", { name: "Your perks" });
}

function showTree(answer: MySkillTree, member: MemberProfile = withTheTree) {
  return renderApp(member, undefined, undefined, undefined, undefined, fixedSkillTree(answer));
}

function showWideTree(answer: MySkillTree, member?: MemberProfile) {
  preferWideScreen();
  return showTree(answer, member);
}

describe("WS85: /skills shows the tree while the Skill tree is open", () => {
  it("lives at /skills with the tab HedgeHug · Skill tree, the label Skill tree and the title Perks", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(pageTitle()).toHaveTextContent("Perks");
    expect(document.title).toBe("HedgeHug · Skill tree");
    expect(within(main()).getByText("Skill tree", { selector: ".hud-label" })).toBeInTheDocument();
  });

  it.each([
    [skillTreeFixtures.withPoints, "2 skill points to spend"],
    [skillTreeFixtures.withOnePoint, "1 skill point to spend"],
    [skillTreeFixtures.noPointsLeft, "No skill points to spend"],
  ])("says how many skill points are left to spend in the header", (answer, line) => {
    showTree(answer);
    expect(within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByText(line)).toBeInTheDocument();
  });

  it("holds one band per shipped row headed Level {level}, with that row's perks in order", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(within(perkTree()).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Perk tree", "Level 5"]);
    expect(nodes().map((node) => node.getAttribute("aria-label")!.split(".")[0])).toEqual(["Spark", "Rhythm", "Circle"]);
  });

  it("frames each perk as a game object with corner marks, its name and its cost while it isn't owned", () => {
    showTree(skillTreeFixtures.sparkOwned);
    expect(nodeOf("Rhythm")).toHaveClass("hud-panel");
    expect(nodeOf("Rhythm")).toHaveTextContent("Rhythm");
    expect(within(nodeOf("Rhythm")).getByTestId("perk-cost")).toHaveTextContent("1");
    expect(within(nodeOf("Spark")).queryByTestId("perk-cost")).toBeNull();
  });

  it("names each node's state, never by colour alone: owned with a check mark, Can buy, or its reason", () => {
    showTree(skillTreeFixtures.noPointsLeft);
    expect(nodeOf("Rhythm")).toHaveAccessibleName("Rhythm. Owned.");
    expect(within(nodeOf("Rhythm")).getByTestId("owned-check")).toBeInTheDocument();
    expect(nodeOf("Spark")).toHaveAccessibleName("Spark. No skill points to spend. Costs 1 skill point.");
    expect(within(nodeOf("Spark")).queryByTestId("owned-check")).toBeNull();
  });

  it.each([
    [skillTreeFixtures.withPoints, "Spark", "Spark. Can buy. Costs 1 skill point."],
    [skillTreeFixtures.belowTheRow, "Spark", "Spark. Opens at level 5. Costs 1 skill point."],
    [skillTreeFixtures.needsABase, "Rhythm", "Rhythm. Needs Spark first. Costs 1 skill point."],
  ])("names a node that isn't owned by its state and its cost", (answer, perk, name) => {
    showTree(answer);
    expect(nodeOf(perk)).toHaveAccessibleName(name);
  });

  it("keeps owned nodes neutral and leaves primary to the selection (V4)", () => {
    showTree(skillTreeFixtures.noPointsLeft);
    expect(nodeOf("Rhythm").className).not.toMatch(/primary/);
  });

  it("selects the first available perk on first load, with aria-pressed and a visible Selected label", () => {
    showTree(skillTreeFixtures.sparkOwned);
    expect(nodeOf("Rhythm")).toHaveAttribute("aria-pressed", "true");
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "false");
    expect(nodeOf("Circle")).toHaveAttribute("aria-pressed", "false");
    expect(within(perkTree()).getAllByText("Selected")).toHaveLength(1);
    expect(within(nodeOf("Rhythm")).getByText("Selected")).toBeVisible();
  });

  it("keeps the first-load selection when that perk turns owned elsewhere, such as in Slack", () => {
    let answer: MySkillTree = skillTreeFixtures.withPoints;
    const { showVisitor } = renderApp(withTheTree, undefined, undefined, undefined, undefined, (asking) => (asking ? answer : undefined));
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "true");
    answer = skillTreeFixtures.sparkOwned;
    showVisitor(shellFixtures.memberWithOneSkillPoint);
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "true");
    expect(nodeOf("Rhythm")).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the first perk when none is available, keeping Selected apart from the owned check", () => {
    showTree(skillTreeFixtures.belowTheRow);
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "true");
    expect(within(nodeOf("Spark")).getByText("Selected")).toBeInTheDocument();
    expect(within(nodeOf("Spark")).queryByTestId("owned-check")).toBeNull();
  });

  it("moves the selection with a click, Enter or Space", async () => {
    const { user } = showWideTree(skillTreeFixtures.withPoints);
    await user.click(nodeOf("Circle"));
    expect(nodeOf("Circle")).toHaveAttribute("aria-pressed", "true");
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "false");
    nodeOf("Rhythm").focus();
    await user.keyboard("{Enter}");
    expect(nodeOf("Rhythm")).toHaveAttribute("aria-pressed", "true");
    nodeOf("Spark").focus();
    await user.keyboard(" ");
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "true");
    expect(within(details()).getByRole("heading", { level: 2 })).toHaveTextContent("Spark");
  });

  it("shows no later rows, coins, perk count or Upgraded legend", () => {
    showTree(skillTreeFixtures.sparkOwned);
    expect(main()).not.toHaveTextContent(/coin|of 14|Upgraded|Level 10/i);
  });
});

describe("WS85 WS86: the selected perk's details", () => {
  it("sit beside the tree on wide screens with the name, P94's copy word for word, the level and the cost", () => {
    showWideTree(skillTreeFixtures.withPoints);
    expect(drawer()).toBeNull();
    const shown = details();
    expect(within(shown).getByRole("heading", { level: 2 })).toHaveTextContent("Spark");
    expect(shown).toHaveTextContent("+5 XP the first time each day you thank someone and say why.");
    expect(shown).toHaveTextContent("Level 5 or higher");
    expect(shown).toHaveTextContent("1 skill point");
  });

  it("say when an owned perk was bought", () => {
    showWideTree(skillTreeFixtures.sparkOwned);
    act(() => nodeOf("Spark").click());
    expect(details()).toHaveTextContent("Owned since 13 Oct 2026");
    expect(details()).not.toHaveTextContent("Buy it in Slack's App Home.");
  });

  it("point an available perk to Slack's App Home until buying ships, with the line a spent point never comes back", () => {
    showWideTree(skillTreeFixtures.withPoints);
    expect(details()).toHaveTextContent("A spent skill point never comes back.");
    expect(details()).toHaveTextContent("Buy it in Slack's App Home.");
    const slack = within(details()).getByRole("link", { name: "Open Slack (opens in a new tab)" });
    expect(slack).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(within(details()).queryByRole("button")).toBeNull();
  });

  it.each([
    [skillTreeFixtures.belowTheRow, "Spark", "Opens at level 5."],
    [skillTreeFixtures.needsABase, "Rhythm", "Needs Spark first."],
    [skillTreeFixtures.noPointsLeft, "Spark", "No skill points to spend. Each level from 5 on gives one."],
  ])("give an unavailable perk's reason", (answer, perk, reason) => {
    showWideTree(answer);
    act(() => nodeOf(perk).click());
    expect(details()).toHaveTextContent(reason);
    expect(details()).not.toHaveTextContent("Buy it in Slack's App Home.");
    expect(details()).not.toHaveTextContent("Owned since");
  });

  it("return focus to the node on Esc even when the press didn't focus it, as Safari's clicks don't", async () => {
    const { user } = showTree(skillTreeFixtures.withPoints);
    fireEvent.click(nodeOf("Rhythm"));
    await screen.findByRole("dialog", { name: "Rhythm" });
    await user.keyboard("{Escape}");
    await act(async () => undefined);
    expect(drawer()).toBeNull();
    expect(nodeOf("Rhythm")).toHaveFocus();
  });

  it("open no drawer for a press made on a wide screen once the screen narrows", async () => {
    const { user, showVisitor } = showWideTree(skillTreeFixtures.withPoints);
    await user.click(nodeOf("Circle"));
    fakeSystemTheme(false);
    showVisitor(withTheTree);
    await act(async () => undefined);
    expect(drawer()).toBeNull();
    expect(nodeOf("Circle")).toHaveAttribute("aria-pressed", "true");
  });

  it("open in a drawer on narrow screens, which Esc closes with focus back on the node", async () => {
    const { user } = showTree(skillTreeFixtures.withPoints);
    expect(within(main()).queryByRole("region", { name: "Perk details" })).toBeNull();
    await user.click(nodeOf("Circle"));
    const opened = await screen.findByRole("dialog", { name: "Circle" });
    expect(opened).toHaveTextContent("+5 XP the first time each week you thank a person and say why.");
    expect(opened).toHaveTextContent("Level 5 or higher");
    await user.keyboard("{Escape}");
    await act(async () => undefined);
    expect(drawer()).toBeNull();
    expect(nodeOf("Circle")).toHaveFocus();
    expect(nodeOf("Circle")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("WS85: Your perks and How perks work", () => {
  it("lists the owned perks in purchase order, each with its P94 copy", () => {
    showTree(skillTreeFixtures.noPointsLeft);
    const items = within(yourPerks()).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("heading").textContent)).toEqual(["Circle", "Rhythm"]);
    expect(items[1]).toHaveTextContent("+2 XP each time you thank someone and say why, once per person a day.");
  });

  it("says perks show there once bought while none is owned", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(yourPerks()).toHaveTextContent("Perks you buy show here, and they're yours for good.");
    expect(within(yourPerks()).queryByRole("listitem")).toBeNull();
  });

  it("says how perks work, word for word", () => {
    showTree(skillTreeFixtures.withPoints);
    expect(within(main()).getByRole("region", { name: "How perks work" })).toHaveTextContent(howPerksWork);
  });

  it("never calls a kudos thoughtful or says the app checked a reason (P95)", () => {
    showWideTree(skillTreeFixtures.sparkOwned);
    expect(document.body).not.toHaveTextContent(/thoughtful|checked|resend|pad /i);
  });
});

describe("WS80: /skills follows its read", () => {
  it("is the not-found page while the read says not-found", () => {
    showTree(skillTreeFixtures.notFound);
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("says Max's Skill tree opens at level 5. with Go to Home while locked, and has no nav item", () => {
    showTree(skillTreeFixtures.locked, shellFixtures.memberWithTheBoardOpened);
    expect(pageTitle()).toHaveTextContent("Skill tree");
    expect(document.title).toBe("HedgeHug · Skill tree");
    expect(main()).toHaveTextContent("Skill tree opens at level 5.");
    expect(within(main()).getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
    expect(within(main()).queryByRole("button")).toBeNull();
    expect(screenNav()).not.toContain("Skill tree");
  });

  it("shows its crate in place with a primary Open while ready, and opens it through openFeature", async () => {
    const openFeature = vi.fn(async (): Promise<CommandAnswer> => ({ kind: "opened" }));
    const { user } = renderApp(shellFixtures.memberWithTheSkillTreeReady, undefined, { openFeature }, undefined, undefined, fixedSkillTree(skillTreeFixtures.ready));
    const crate = within(main()).getByRole("heading", { name: "Unlocks: Skill tree" }).closest("article")!;
    const open = within(crate).getByRole("button", { name: "Open" });
    expect(open).toHaveClass("quill-button--variant-primary");
    expect(screenNav()).not.toContain("Skill tree");

    await user.click(open);

    expect(openFeature).toHaveBeenCalledWith("skillTree");
  });

  it("becomes the tree once opened, with focus on its title when the reveal closes", async () => {
    let answer: MySkillTree = skillTreeFixtures.ready;
    const { user, showVisitor } = renderApp(shellFixtures.memberWithTheSkillTreeReady, undefined, { openFeature: async () => ({ kind: "opened" }) }, undefined, undefined, (asking) => (asking ? answer : undefined));
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    answer = skillTreeFixtures.withPoints;
    showVisitor(shellFixtures.memberWithEveryFeatureOpen);
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    expect(pageTitle()).toHaveTextContent("Perks");
    expect(pageTitle()).toHaveFocus();
    expect(perkTree()).toBeInTheDocument();
  });

  it("marks its nav item current while open", () => {
    showTree(skillTreeFixtures.withPoints);
    const nav = within(screen.getByRole("navigation", { name: "Screens" }));
    expect(nav.getByRole("link", { name: "Skill tree" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Skill tree" })).toHaveAttribute("href", "/skills");
  });

  it("asks for the tree only on /skills", () => {
    window.history.replaceState(null, "", "/");
    const asked: boolean[] = [];
    renderApp(withTheTree, undefined, undefined, undefined, undefined, (asking) => {
      asked.push(asking);
      return asking ? skillTreeFixtures.withPoints : undefined;
    });
    expect(asked.every((asking) => !asking)).toBe(true);
  });
});

describe("WS84: the HUD's skill point chip", () => {
  function chip() {
    return within(screen.getByRole("banner")).queryByRole("link", { name: /skill points? to spend$/ });
  }

  it.each([
    [shellFixtures.memberWithEveryFeatureOpen, "2", "2 skill points to spend"],
    [shellFixtures.memberWithOneSkillPoint, "1", "1 skill point to spend"],
    [shellFixtures.memberWithNoSkillPointsLeft, "0", "0 skill points to spend"],
  ])("shows {n} with a glyph, named n skill points to spend, linking to /skills", (member, count, name) => {
    window.history.replaceState(null, "", "/");
    renderApp(member);
    expect(chip()).toHaveAccessibleName(name);
    expect(chip()).toHaveTextContent(count);
    expect(chip()).toHaveAttribute("href", "/skills");
  });

  it("is absent while skillPoints is null", () => {
    window.history.replaceState(null, "", "/");
    renderApp(shellFixtures.memberWithTheBoardOpened);
    expect(chip()).toBeNull();
  });

  it("leads to the skill tree page", async () => {
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(withTheTree, undefined, undefined, undefined, undefined, fixedSkillTree(skillTreeFixtures.withPoints));
    await user.click(chip()!);
    expect(window.location.pathname).toBe("/skills");
    expect(pageTitle()).toHaveTextContent("Perks");
  });
});
