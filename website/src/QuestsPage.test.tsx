import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import type { QuestsRead } from "./questsRead";
import { shellFixtures, type MyQuests } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const withQuests = shellFixtures.memberWithQuests;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/quests");
});

function main() {
  return screen.getByRole("main");
}

function screens() {
  return screen.getByRole("navigation", { name: "Screens" });
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function questCards() {
  return within(main()).getByRole("region", { name: "Your quests" });
}

function cardOf(goal: string) {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function showQuests(answer: MyQuests) {
  return renderApp(withQuests, undefined, undefined, fixedQuests(answer));
}

describe("WS73: /quests shows this week's quests while Quests is open", () => {
  it("lives at /quests with the tab HedgeHug · Quests, the header This week, and when new quests arrive", () => {
    showQuests(questsFixtures.week);
    expect(pageTitle()).toHaveTextContent("This week");
    expect(document.title).toBe("HedgeHug · Quests");
    expect(within(main()).getByText("New quests arrive every Monday.")).toBeInTheDocument();
  });

  it("shows one card per drawn quest, in slot order, each with its kind, goal and reward", () => {
    showQuests(questsFixtures.week);
    const goals = within(questCards())
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(goals).toEqual(["Thank someone and say why, 3 times.", "Thank someone you haven't thanked before.", "Thank someone you haven't thanked in the last 30 days."]);
    const card = cardOf("Thank someone and say why, 3 times.");
    expect(card).toHaveTextContent("Say why");
    expect(card).toHaveTextContent("20 XP");
    expect(cardOf("Thank someone you haven't thanked before.")).toHaveTextContent("Reach out");
  });

  it("exposes each quest's progress as a neutral progressbar labelled done of target", () => {
    showQuests(questsFixtures.week);
    const progress = within(cardOf("Thank someone and say why, 3 times.")).getByRole("progressbar", { name: "1 of 3" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "3");
    expect(progress.outerHTML).not.toMatch(/primary|success|warning|danger/);
  });

  it("tags only a swapped quest Swapped", () => {
    showQuests(questsFixtures.week);
    expect(cardOf("Thank someone you haven't thanked in the last 30 days.")).toHaveTextContent("Swapped");
    expect(cardOf("Thank someone and say why, 3 times.")).not.toHaveTextContent("Swapped");
  });

  it("shows a finished quest as its crate, pointing to Slack's App Home until the website can open it", () => {
    showQuests(questsFixtures.week);
    const card = cardOf("Thank someone you haven't thanked before.");
    expect(within(card).getByText("Quest reward · 20 XP")).toBeInTheDocument();
    expect(card).toHaveTextContent("Ready for you. Open it in Slack's App Home.");
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads ✓ Done for an opened quest", () => {
    showQuests(questsFixtures.week);
    expect(cardOf("Thank someone you haven't thanked in the last 30 days.")).toHaveTextContent("✓ Done");
    expect(cardOf("Thank someone and say why, 3 times.")).not.toHaveTextContent("Done");
  });

  it("shows fewer cards when fewer quests were drawn", () => {
    showQuests(questsFixtures.twoQuests);
    expect(within(questCards()).getAllByRole("article")).toHaveLength(2);
  });

  it("lists earlier weeks' unopened crates under Waiting to open, with their goal and reward", () => {
    showQuests(questsFixtures.weekWithLastWeeksCrate);
    const waiting = within(main()).getByRole("region", { name: "Waiting to open" });
    expect(within(waiting).getByText("Quest reward · 20 XP")).toBeInTheDocument();
    expect(waiting).toHaveTextContent("Thank someone and say why on 2 different days.");
    expect(waiting).toHaveTextContent("Ready for you. Open it in Slack's App Home.");
  });

  it("has no Waiting to open section while nothing from an earlier week waits", () => {
    showQuests(questsFixtures.week);
    expect(within(main()).queryByRole("region", { name: "Waiting to open" })).not.toBeInTheDocument();
  });

  it("shows Max's empty state with one action that opens Slack when nothing was drawn", () => {
    showQuests(questsFixtures.noDraw);
    expect(within(main()).queryByRole("region", { name: "Your quests" })).not.toBeInTheDocument();
    expect(within(main()).getByText("You have no quests this week.")).toBeInTheDocument();
    const openSlack = within(main()).getByRole("link", { name: "Open Slack (opens in a new tab)" });
    expect(openSlack).toHaveAttribute("href", "https://app.slack.com/client/T1");
  });

  it("explains how quests work in WS73's words", () => {
    showQuests(questsFixtures.week);
    const how = within(main()).getByRole("region", { name: "How quests work" });
    expect(how).toHaveTextContent(
      "Quests reward thanking someone new, someone you haven't thanked in a while, and thanks that say why. A thanks says why when your message has 5 or more words besides mentions and emoji. New quests arrive every Monday. You can swap one quest a week in Slack's App Home.",
    );
  });

  it("offers no swap, group quest, bonus quest or claim, and never calls a kudos thoughtful", () => {
    showQuests(questsFixtures.weekWithLastWeeksCrate);
    expect(within(main()).queryByRole("button")).not.toBeInTheDocument();
    expect(main()).not.toHaveTextContent(/group quest|bonus|claim|thoughtful|reroll/i);
  });

  it("turns over to the new week when the read answers it", () => {
    let answer: MyQuests = questsFixtures.week;
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(withQuests, undefined, undefined, read);
    answer = questsFixtures.nextWeek;
    showVisitor(withQuests);
    expect(within(questCards()).getAllByRole("article")).toHaveLength(1);
    expect(cardOf("Thank 2 people you haven't thanked before.")).toBeInTheDocument();
  });
});

describe("WS73 WS67 WS69: /quests while Quests isn't open", () => {
  it("is the not-found page while quests don't apply", () => {
    renderApp(shellFixtures.member, undefined, undefined, fixedQuests(questsFixtures.notFound));
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("says at which level Quests opens while it is locked", () => {
    renderApp(shellFixtures.memberStartingTheJourney, undefined, undefined, fixedQuests(questsFixtures.locked));
    expect(pageTitle()).toHaveTextContent("Quests");
    expect(document.title).toBe("HedgeHug · Quests");
    expect(main()).toHaveTextContent("Quests opens at level 2.");
  });

  it("shows the Quests crate with a primary Open in place while it is ready", () => {
    renderApp(shellFixtures.memberWithQuestsReady, undefined, undefined, fixedQuests(questsFixtures.ready));
    const crate = within(main()).getByRole("heading", { name: "Unlocks: Quests" }).closest("article")!;
    expect(within(crate).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-primary");
  });
});

describe("WS73 WS59: the nav shows Quests while it is open", () => {
  it("lists Quests after Home and marks it current on /quests", () => {
    showQuests(questsFixtures.week);
    const quests = within(screens()).getByRole("link", { name: "Quests" });
    expect(quests).toHaveAttribute("href", "/quests");
    expect(quests).toHaveAttribute("aria-current", "page");
    expect(within(screens()).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home", "Quests"]);
  });

  it.each([
    ["locked", shellFixtures.memberStartingTheJourney],
    ["ready", shellFixtures.memberWithQuestsReady],
  ])("has no Quests item while Quests is %s", (_, member) => {
    window.history.replaceState(null, "", "/");
    renderApp(member);
    expect(within(screens()).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home"]);
  });

  it("goes to /quests from the nav without a reload, moving focus to the page title", async () => {
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(withQuests, undefined, undefined, fixedQuests(questsFixtures.week));
    await user.click(within(screens()).getByRole("link", { name: "Quests" }));
    expect(window.location.pathname).toBe("/quests");
    expect(pageTitle()).toHaveTextContent("This week");
    expect(pageTitle()).toHaveFocus();
  });
});
