import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixedQuests, groupQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const withQuests = shellFixtures.memberWithQuests;
const goal = "Thank someone and say why.";
const opened: OpenAnswer = { kind: "opened", applied: null };

beforeEach(() => {
  fakeSystemTheme(false);
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function main() {
  return screen.getByRole("main");
}

function groupQuest() {
  return within(main()).getByRole("region", { name: "Group quest · Ants" });
}

function showQuests(answer: MyQuests, openQuestCrate = async (): Promise<OpenAnswer> => opened) {
  visit("/quests");
  return renderApp(withQuests, undefined, { openQuestCrate }, fixedQuests(answer));
}

function showHome(answer: MyQuests) {
  visit("/");
  return renderApp(withQuests, undefined, undefined, fixedQuests(answer));
}

function questsPanel() {
  return within(main()).getByRole("region", { name: "Quests this week" });
}

describe("WS344 P82: /quests shows the member's group quest beside the personal quests, as counts", () => {
  it("heads it with the group, and shows the goal, how many took part of the target, the reward and the shared-reward sentence", () => {
    showQuests(questsFixtures.weekWithTheGroupQuest);
    const card = groupQuest();
    expect(within(card).getByRole("heading", { name: goal })).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: "1 of 3 took part" })).toHaveAttribute("aria-valuenow", "1");
    expect(card).toHaveTextContent("1 of 3 took part");
    expect(card).toHaveTextContent("15 coins");
    expect(card).toHaveTextContent("Everyone in Ants who takes part gets the reward once 3 have.");
    expect(within(card).getByText("You took part")).toBeInTheDocument();
  });

  it("never names who took part: the card says only the group, the goal, the counts, the reward and the viewer's own part", () => {
    showQuests(questsFixtures.weekWithTheGroupQuest);
    expect(groupQuest()).toHaveTextContent(/^Group quest · AntsYou took partThank someone and say why\.1 of 3 took part15 coinsEveryone in Ants who takes part gets the reward once 3 have\.$/);
  });

  it("leaves out You took part while the viewer hasn't", () => {
    showQuests({ ...questsFixtures.weekWithTheGroupQuest, group: { ...groupQuests.groupInProgress, you: false } });
    expect(within(groupQuest()).queryByText("You took part")).not.toBeInTheDocument();
  });

  it("finished with the viewer's crate: Claim opens the group crate through openQuestCrate", async () => {
    const { actions, user } = showQuests(questsFixtures.weekWithTheGroupQuestFinished);
    expect(within(groupQuest()).getByRole("progressbar", { name: "3 of 3 took part" })).toBeInTheDocument();
    await user.click(within(groupQuest()).getByRole("button", { name: "Claim" }));
    expect(actions.openQuestCrate).toHaveBeenCalledWith(groupQuests.groupFinished.crate);
  });

  it("finished without the viewer: no Claim, and it says how to get the reward too", () => {
    showQuests(questsFixtures.weekWithTheGroupQuestFinishedWithoutYou);
    expect(within(groupQuest()).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(groupQuest()).toHaveTextContent("Ants finished it. Take part this week to get the reward too.");
  });

  it("claimed: Claimed, and no Claim", () => {
    showQuests(questsFixtures.weekWithTheGroupQuestClaimed);
    expect(within(groupQuest()).getByText("Claimed")).toBeInTheDocument();
    expect(within(groupQuest()).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("shows no group quest when the member has none", () => {
    showQuests(questsFixtures.week);
    expect(within(main()).queryByRole("region", { name: /^Group quest/ })).not.toBeInTheDocument();
  });

  it("an earlier week's group crate waits to open, labelled with its group", async () => {
    const { actions, user } = showQuests(questsFixtures.weekWithLastWeeksGroupCrate);
    const waiting = within(main()).getByRole("region", { name: "Waiting to open" });
    const card = within(waiting).getByRole("heading", { name: "Thank someone outside Ants." }).closest("article")!;
    expect(card).toHaveTextContent("Ants quest");
    await user.click(within(card).getByRole("button", { name: "Claim" }));
    expect(actions.openQuestCrate).toHaveBeenCalledWith(groupQuests.lastWeeksGroupCrate.crate);
  });
});

describe("WS344: the home's Quests this week has a row for the group quest", () => {
  it("shows the group quest after the personal quests with its counts, linking to it on /quests", () => {
    showHome(questsFixtures.weekWithTheGroupQuest);
    const row = within(questsPanel()).getByRole("link", { name: /Ants quest: Thank someone and say why\./ });
    expect(row).toHaveAttribute("href", "/quests?quest=group");
    expect(within(questsPanel()).getByRole("progressbar", { name: "Ants quest: Thank someone and say why." })).toHaveAttribute("aria-valuenow", "1");
    expect(within(questsPanel()).getAllByRole("listitem").at(-1)).toContainElement(row);
  });

  it("says Claim once the viewer's crate waits, and Claimed once opened", () => {
    const { unmount } = showHome(questsFixtures.weekWithTheGroupQuestFinished);
    expect(within(questsPanel()).getByRole("link", { name: /Ants quest: .* Claim$/ })).toBeInTheDocument();
    unmount();
    showHome(questsFixtures.weekWithTheGroupQuestClaimed);
    const row = within(questsPanel()).getByRole("link", { name: /Ants quest:/ }).closest("li")!;
    expect(within(row).getByText("Claimed")).toBeInTheDocument();
  });
});

describe("WS344: /quests?quest=group lands on the group quest", () => {
  it("/quests?quest=group focuses the group quest's goal", () => {
    visit("/quests?quest=group");
    renderApp(withQuests, undefined, undefined, fixedQuests(questsFixtures.weekWithTheGroupQuest));
    expect(within(groupQuest()).getByRole("heading", { name: goal })).toHaveFocus();
  });
});

describe("#435: ?crate={feature} lands on the page's ready crate", () => {
  it("/quests?crate=group focuses the group crate's Claim, never opening it", () => {
    visit("/quests?crate=group");
    const { actions } = renderApp(withQuests, undefined, undefined, fixedQuests(questsFixtures.weekWithTheGroupQuestFinished));
    expect(within(groupQuest()).getByRole("button", { name: "Claim" })).toHaveFocus();
    expect(actions.openQuestCrate).not.toHaveBeenCalled();
  });

  it("ignores /quests?crate=group while the group quest has no crate waiting", () => {
    visit("/quests?crate=group");
    renderApp(withQuests, undefined, undefined, fixedQuests(questsFixtures.weekWithTheGroupQuest));
    expect(groupQuest()).not.toContainElement(document.activeElement as HTMLElement);
  });
});

describe("WS339: the group quest passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    it(`on /quests and the home in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const quests = showQuests(questsFixtures.weekWithLastWeeksGroupCrate);
      expect(await violationsIn(quests.container)).toEqual([]);
      quests.unmount();
      const finished = showQuests(questsFixtures.weekWithTheGroupQuestFinished);
      expect(await violationsIn(finished.container)).toEqual([]);
      finished.unmount();
      const home = showHome(questsFixtures.weekWithTheGroupQuestFinished);
      expect(await violationsIn(home.container)).toEqual([]);
    }, 30_000);
  }
});

async function violationsIn(container: Element) {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
