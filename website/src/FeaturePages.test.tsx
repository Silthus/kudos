import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type CommandAnswer, type Feature, type MemberProfile } from "./shell";
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

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

function screenNav() {
  return within(screen.getByRole("navigation", { name: "Screens" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function dialog() {
  return screen.queryByRole("dialog");
}

type FeaturePage = {
  path: string;
  feature: Feature;
  name: string;
  level: number;
  locked: MemberProfile;
  ready: MemberProfile;
  opened: MemberProfile;
};

const featurePages: FeaturePage[] = [
  {
    path: "/skills",
    feature: "skillTree",
    name: "Skill tree",
    level: 5,
    locked: shellFixtures.memberWithTheBoardOpened,
    ready: shellFixtures.memberWithTheSkillTreeReady,
    opened: shellFixtures.memberWithEveryFeatureOpen,
  },
];

describe.each(featurePages)("WS78 WS80: $path follows its unlock", ({ path, feature, name, level, locked, ready, opened }) => {
  beforeEach(() => visit(path));

  it("is the not-found page while unlocks don't apply", () => {
    renderApp(shellFixtures.member);
    expect(pageTitle()).toHaveTextContent("Page not found");
    expect(document.title).toBe("HedgeHug · Not found");
  });

  it("is the not-found page while the feature hasn't shipped", () => {
    renderApp(shellFixtures.memberWaitingForTheBoard);
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it(`says Max's ${name} opens at level ${level}. with Go to Home while locked, and has no nav item`, () => {
    renderApp(locked);
    expect(pageTitle()).toHaveTextContent(name);
    expect(document.title).toBe(`HedgeHug · ${name}`);
    expect(main()).toHaveTextContent(`${name} opens at level ${level}.`);
    expect(within(main()).getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
    expect(within(main()).queryByRole("button")).toBeNull();
    expect(screenNav()).not.toContain(name);
  });

  it("shows its crate in place with a primary Open while ready, and opens it through openFeature", async () => {
    const openFeature = vi.fn(async (): Promise<CommandAnswer> => ({ kind: "opened" }));
    const { user } = renderApp(ready, undefined, { openFeature });
    expect(pageTitle()).toHaveTextContent(name);
    expect(document.title).toBe(`HedgeHug · ${name}`);
    const crate = within(main()).getByRole("heading", { name: `Unlocks: ${name}` }).closest("article")!;
    const open = within(crate).getByRole("button", { name: "Open" });
    expect(open).toHaveClass("quill-button--variant-primary");
    expect(screenNav()).not.toContain(name);

    await user.click(open);

    expect(openFeature).toHaveBeenCalledWith(feature);
  });

  it("becomes the open page once opened, with focus on its title when the reveal closes", async () => {
    const { user, showVisitor } = renderApp(ready, undefined, { openFeature: async () => ({ kind: "opened" }) });
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    showVisitor(opened);
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    expect(main()).toHaveTextContent(`${name} is open. Find it in Slack's App Home.`);
    expect(pageTitle()).toHaveFocus();
  });

  it("is open: its sentence and one action that opens the workspace in Slack, until its own page ships", () => {
    renderApp(opened);
    expect(pageTitle()).toHaveTextContent(name);
    expect(document.title).toBe(`HedgeHug · ${name}`);
    expect(main()).toHaveTextContent(`${name} is open. Find it in Slack's App Home.`);
    const actions = [...within(main()).queryAllByRole("link"), ...within(main()).queryAllByRole("button")];
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAccessibleName("Open Slack (opens in a new tab)");
    expect(actions[0]).toHaveAttribute("href", opened.chatUrl);
    expect(actions[0]).toHaveAttribute("target", "_blank");
  });

  it("marks its nav item current while open", () => {
    renderApp(opened);
    const nav = within(screen.getByRole("navigation", { name: "Screens" }));
    expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name })).toHaveAttribute("href", path);
  });
});

describe("WS81: the pages join the nav, the home and the crate", () => {
  beforeEach(() => visit("/"));

  it("lists each open feature with a web page in schedule order", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(screenNav()).toEqual(["Home", "Leaderboard", "Book", "Skill tree"]);
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
