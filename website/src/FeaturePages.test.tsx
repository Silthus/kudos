import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { navEntryNames as screenNav } from "./test/screensNav";
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

function dialog() {
  return screen.queryByRole("dialog");
}

describe("WS81: the pages join the nav, the home and the crate", () => {
  beforeEach(() => visit("/"));

  it("lists each open feature with a web page in schedule order", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(screenNav()).toEqual(["Profile", "Leaderboard", "Book", "Skill tree"]);
  });

  it.each([
    ["Skill tree", "/skills", "Spend skill points on perks you choose."],
    ["Book", "/book", "See the tiers you've earned."],
  ])("links the home's open %s card to its page with its sentence and no count", (name, href, sentence) => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    const card = within(within(main()).getByRole("region", { name: "Open" })).getByRole("link", { name: new RegExp(name) });
    expect(card).toHaveAttribute("href", href);
    expect(card).toHaveTextContent(sentence);
    expect(card).not.toHaveTextContent(/\d|Slack/);
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
    const card = within(main()).getByRole("heading", { level: 3, name: "Book" }).closest("article")!;
    expect(card).toHaveTextContent("Achievements you earn as you thank colleagues and they thank you.");
    expect(main()).not.toHaveTextContent(/sticker|album/i);
  });
});
