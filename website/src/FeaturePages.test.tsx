import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function main() {
  return screen.getByRole("main");
}

function screenNav() {
  return within(screen.getByRole("navigation", { name: "Screens" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function dialog() {
  return screen.queryByRole("dialog");
}

describe("WS81: the pages join the nav, the home and the crate", () => {
  beforeEach(() => visit("/"));

  it("lists each open feature with a web page in schedule order", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(screenNav()).toEqual(["Home", "Leaderboard", "Book", "Skill tree"]);
  });

  it.each([
    ["Skill tree", "Open the Skill tree", "/skills", "2 skill points to spend"],
    ["Book", "Open the Book", "/book", "See the tiers you've earned."],
  ])("links the home's open %s panel to its page under its line", (name, link, href, line) => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    const panel = within(main()).getByRole("region", { name });
    expect(within(panel).getByRole("link", { name: link })).toHaveAttribute("href", href);
    expect(panel).toHaveTextContent(line);
    expect(panel).not.toHaveTextContent(/Slack/);
  });

  it("no longer points the open Skill tree to Slack's App Home", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(main()).not.toHaveTextContent("Open. Find it in Slack's App Home.");
  });

  it.each([
    ["Skill tree", "/skills", shellFixtures.memberWithTheSkillTreeReady],
    ["Book", "/book", shellFixtures.memberWithTheBookReady],
  ])("ends the %s reveal on Go to its page", async (name, href, member) => {
    const { user } = renderApp(member, undefined, { openFeature: async () => ({ kind: "opened" }) });
    const crate = within(main()).getByRole("heading", { level: 3, name: `Unlocks: ${name}` }).closest("article")!;
    await user.click(within(crate).getByRole("button", { name: "Open" }));
    await act(async () => undefined);
    await user.keyboard("{Escape}");
    expect(within(dialog()!).getByRole("link", { name: `Go to ${name}` })).toHaveAttribute("href", href);
  });
});

describe("WS82: the Book's card names only what has shipped", () => {
  it("says the Book holds achievements, and names no stickers or albums", () => {
    visit("/");
    renderApp(shellFixtures.memberWaitingForTheBook);
    const card = within(main()).getByRole("region", { name: "Book" });
    expect(card).toHaveTextContent("Achievements you earn as you thank colleagues and they thank you.");
    expect(main()).not.toHaveTextContent(/sticker|album/i);
  });
});
