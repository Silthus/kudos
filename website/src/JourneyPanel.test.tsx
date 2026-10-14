import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function main() {
  return screen.getByRole("main");
}

function journey() {
  return within(main()).getByRole("region", { name: "Journey" });
}

function stepOf(goal: string) {
  return within(journey()).getByRole("heading", { name: goal }).closest("li")!;
}

function comesBefore(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("WS72: the Journey panel on the home", () => {
  it("shows an active step's goal, its hint and what it pays", () => {
    renderApp(shellFixtures.memberStartingTheJourney);
    const step = stepOf("Give a kudos that says why.");
    expect(step).toHaveTextContent("It counts when your message has 5 or more words besides mentions and emoji.");
    expect(step).toHaveTextContent("Pays 10 XP");
  });

  it("WS72 WS74: shows a finished step as its crate with an outline Open", () => {
    renderApp(shellFixtures.memberWithQuests);
    const step = stepOf("Finish a weekly quest.");
    expect(within(step).getByText("Journey reward · 20 XP")).toBeInTheDocument();
    expect(step).not.toHaveTextContent("Open it in Slack's App Home");
    expect(within(step).getAllByRole("button")).toEqual([within(step).getByRole("button", { name: "Open" })]);
    expect(within(step).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-outline");
    expect(step).not.toHaveTextContent("Pays");
  });

  it("shows an opened step as done, with the XP it earned", () => {
    renderApp(shellFixtures.memberWithQuests);
    const step = stepOf("Give a kudos that says why.");
    expect(step).toHaveTextContent("✓ Done · You earned 10 XP");
    expect(step).not.toHaveTextContent("Pays");
  });

  it("lists the steps in chain order with no step count", () => {
    renderApp(shellFixtures.memberWithQuests);
    const goals = within(journey())
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(goals).toEqual(["Give a kudos that says why.", "Finish a weekly quest.", "Thank someone you haven't thanked before."]);
    expect(journey()).not.toHaveTextContent(/\d+ of \d+|step \d|thoughtful|claim/i);
  });

  it("is a game object with corner marks, after the hero and the counters and before the feature cards", () => {
    renderApp(shellFixtures.memberWithQuests);
    expect(journey()).toHaveClass("hud-panel");
    expect(comesBefore(within(main()).getByRole("table", { name: "Your kudos" }), journey())).toBe(true);
    expect(comesBefore(journey(), within(main()).getByRole("region", { name: "Open" }))).toBe(true);
  });

  it("is absent while quests don't apply", () => {
    renderApp(shellFixtures.memberWithTheBoardReady);
    expect(within(main()).queryByRole("region", { name: "Journey" })).not.toBeInTheDocument();
  });
});

describe("WS72 WS58: the Quests card on the home", () => {
  it("links an open Quests to /quests with Your quests this week., and no count", () => {
    renderApp(shellFixtures.memberWithQuests);
    const card = within(within(main()).getByRole("region", { name: "Open" })).getByRole("link", { name: /Quests/ });
    expect(card).toHaveAttribute("href", "/quests");
    expect(card).toHaveTextContent("Your quests this week.");
    expect(card).not.toHaveTextContent(/\d/);
  });

  it("WS75: describes a locked Quests by the quests a member gets, with no group quest", () => {
    renderApp(shellFixtures.memberStartingTheJourney);
    const card = within(within(main()).getByRole("region", { name: "Still locked" })).getByRole("heading", { name: "Quests" }).closest("article")!;
    expect(card).toHaveTextContent("Weekly quests of your own.");
    expect(card).not.toHaveTextContent(/group/i);
  });

  it("goes to /quests with Enter, moving focus to the page title", async () => {
    const { user } = renderApp(shellFixtures.memberWithQuests);
    within(within(main()).getByRole("region", { name: "Open" })).getByRole("link", { name: /Quests/ }).focus();
    await user.keyboard("{Enter}");
    expect(window.location.pathname).toBe("/quests");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});
