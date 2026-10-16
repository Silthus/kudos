import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { Collection } from "./collectionRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import type { BoardRead } from "./boardRead";
import type { QuestsRead, QuestsShown } from "./questsRead";
import { shellFixtures, type ItemBuyAnswer, type MemberProfile, type MyQuests, type MySettings, type MySkillTree, type ShellState } from "./shell";
import type { SkillTreeRead, SkillTreeShown } from "./skillTreeRead";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const withTheTree = shellFixtures.memberWithEveryFeatureOpen;

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

function watchScrolling() {
  const scrolled: Element[] = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    if (this.closest("main") !== null) scrolled.push(this);
  };
  return scrolled;
}

function perkNode(name: string) {
  return within(within(main()).getByRole("region", { name: "Perk tree" })).getByRole("button", { name: new RegExp(`^${name}\\.`) });
}

function detailsTitle() {
  return within(within(main()).getByRole("region", { name: "Perk details" })).getByRole("heading", { level: 2 });
}

function treeLandingLater(answer: MySkillTree) {
  let landed = false;
  const read: SkillTreeRead = (asking) => (asking && landed ? answer : undefined);
  return { read, land: () => (landed = true) };
}

function showTreeAt(path: string, answer: MySkillTree, member: MemberProfile = withTheTree) {
  visit(path);
  return renderApp(member, undefined, undefined, undefined, undefined, fixedSkillTree(answer));
}

describe("#435: /skills?perk={perkId} lands on that perk", () => {
  it("scrolls the perk's node into view, focuses it and shows its details once the tree lands", () => {
    preferWideScreen();
    const scrolled = watchScrolling();
    visit("/skills?perk=circle");
    const later = treeLandingLater(skillTreeFixtures.withPoints);
    const { showVisitor } = renderApp(withTheTree, undefined, undefined, undefined, undefined, later.read);
    expect(scrolled).toEqual([]);
    later.land();
    showVisitor({ ...withTheTree });

    expect(scrolled).toEqual([perkNode("Circle")]);
    expect(perkNode("Circle")).toHaveFocus();
    expect(perkNode("Circle")).toHaveAttribute("aria-pressed", "true");
    expect(detailsTitle()).toHaveTextContent("Circle");
    expect(window.location.search).toBe("?perk=circle");
  });

  it("opens the perk's drawer on a narrow screen, and closing it returns to the node", async () => {
    const scrolled = watchScrolling();
    const { user } = showTreeAt("/skills?perk=rhythm", skillTreeFixtures.withPoints);

    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toHaveAccessibleName(/^Rhythm\./);
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Rhythm" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(perkNode("Rhythm")).toHaveFocus();
  });

  it("lands on a perk the member owns", () => {
    preferWideScreen();
    const scrolled = watchScrolling();
    showTreeAt("/skills?perk=spark", skillTreeFixtures.sparkOwned);

    expect(scrolled).toEqual([perkNode("Spark")]);
    expect(perkNode("Spark")).toHaveFocus();
    expect(detailsTitle()).toHaveTextContent("Spark");
  });

  it.each([
    ["a locked perk", "/skills?perk=circle", skillTreeFixtures.everyState],
    ["a perk the tree doesn't hold", "/skills?perk=banker", skillTreeFixtures.withPoints],
    ["an unknown perk", "/skills?perk=nope", skillTreeFixtures.withPoints],
    ["an empty perk", "/skills?perk=", skillTreeFixtures.withPoints],
  ])("falls back to the plain page for %s", (_, path, answer) => {
    const scrolled = watchScrolling();
    showTreeAt(path, answer);

    expect(scrolled).toEqual([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it("selects the page's own first choice for a locked perk", () => {
    preferWideScreen();
    showTreeAt("/skills?perk=circle", skillTreeFixtures.everyState);
    expect(detailsTitle()).toHaveTextContent("Rhythm");
  });
});

const notYet: BoardRead = (period) => (period === undefined ? undefined : { kind: "ready" });

const readyPages: { name: string; path: string; member: ShellState; reads: (member: ShellState) => ReturnType<typeof renderApp> }[] = [
  { name: "Quests", path: "/quests?crate=quests", member: shellFixtures.memberWithTheQuestsReady, reads: (member) => renderApp(member, undefined, undefined, fixedQuests(questsFixtures.ready)) },
  { name: "Leaderboard", path: "/leaderboard?crate=leaderboard", member: shellFixtures.memberWithTheBoardReady, reads: (member) => renderApp(member, notYet) },
  { name: "Book", path: "/book?crate=book", member: shellFixtures.memberWithTheBookReady, reads: (member) => renderApp(member, undefined, undefined, undefined, fixedBook(bookFixtures.ready)) },
  { name: "Skill tree", path: "/skills?crate=skillTree", member: shellFixtures.memberWithTheSkillTreeReady, reads: (member) => renderApp(member, undefined, undefined, undefined, undefined, fixedSkillTree(skillTreeFixtures.ready)) },
];

function readyBand() {
  return within(main()).getByRole("heading", { level: 1, name: /ready$/ }).closest("section")!;
}

describe("#435: ?crate={feature} lands on the page's ready crate", () => {
  it.each(readyPages)("$path scrolls to the ready crate and focuses its Open, never opening it", ({ path, member, reads }) => {
    const scrolled = watchScrolling();
    visit(path);
    const { actions } = reads(member);

    const open = within(readyBand()).getByRole("button", { name: "Open" });
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]!.contains(open)).toBe(true);
    expect(open).toHaveFocus();
    expect(actions.openFeature).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["an unknown crate", "/quests?crate=nope"],
    ["another page's crate", "/quests?crate=book"],
  ])("ignores %s", (_, path) => {
    const scrolled = watchScrolling();
    visit(path);
    renderApp(shellFixtures.memberWithTheQuestsReady, undefined, undefined, fixedQuests(questsFixtures.ready));

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("/?crate=journey scrolls to the Journey step's crate and focuses its Open, never opening it", () => {
    const scrolled = watchScrolling();
    visit("/?crate=journey");
    const { actions } = renderApp(shellFixtures.memberWithQuests);

    const step = within(within(main()).getByRole("region", { name: "Journey" })).getByRole("heading", { name: "Finish a weekly quest." }).closest("li")!;
    expect(scrolled).toEqual([step]);
    expect(within(step).getByRole("button", { name: "Open" })).toHaveFocus();
    expect(actions.openQuestCrate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores ?crate=journey while no Journey step waits to be opened", () => {
    const scrolled = watchScrolling();
    visit("/?crate=journey");
    renderApp(shellFixtures.memberStartingTheJourney);

    expect(scrolled).toEqual([]);
  });
});

function waitingCard(week: string) {
  return within(within(main()).getByRole("region", { name: "Waiting to open" }))
    .getAllByRole("article")
    .find((card) => card.querySelector(`time[datetime="${week}"]`) !== null)!;
}

const twoWeeksOfTheSameSlot = sameSlotIn(questsFixtures.weekWithTheSameQuestWaitingFromTwoWeeks);

function sameSlotIn(answer: Extract<MyQuests, { kind: "quests" }>): MyQuests {
  return { ...answer, waiting: answer.waiting.map((entry) => (entry.crate.kind === "weekly" ? { ...entry, crate: { ...entry.crate, slot: 0 } } : entry)) };
}

function showQuestsAt(path: string, answer: MyQuests) {
  visit(path);
  return renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(answer));
}

describe("#500: ?crate=weekly:{week}:{slot} lands on an earlier week's waiting crate", () => {
  it("scrolls to that week's crate and focuses its Claim, never opening it", () => {
    const scrolled = watchScrolling();
    const { actions } = showQuestsAt("/quests?crate=weekly%3A2026-10-05%3A0", questsFixtures.weekWithTheSameQuestWaitingFromTwoWeeks);

    const card = waitingCard("2026-10-05");
    expect(scrolled).toEqual([card]);
    expect(within(card).getByRole("button", { name: "Claim" })).toHaveFocus();
    expect(actions.openQuestCrate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["2026-10-05", "2026-09-28"])("tells two weeks' crates of the same slot apart, landing on %s's", (week) => {
    const scrolled = watchScrolling();
    showQuestsAt(`/quests?crate=weekly:${week}:0`, twoWeeksOfTheSameSlot);

    const card = waitingCard(week);
    expect(scrolled).toEqual([card]);
    expect(within(card).getByRole("button", { name: "Claim" })).toHaveFocus();
  });

  it.each([
    ["a crate already opened", "/quests?crate=weekly:2026-09-21:0"],
    ["another slot of that week", "/quests?crate=weekly:2026-10-05:1"],
    ["a broken target", "/quests?crate=weekly:2026-10-05"],
  ])("lands on the plain page for %s", (_, path) => {
    const scrolled = watchScrolling();
    showQuestsAt(path, questsFixtures.weekWithTheSameQuestWaitingFromTwoWeeks);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("lands once the quests answer after connecting", () => {
    const scrolled = watchScrolling();
    visit("/quests?crate=weekly:2026-10-05:0");
    let answer: QuestsShown = { kind: "connecting" };
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(shellFixtures.memberWithQuests, undefined, undefined, read);
    expect(scrolled).toEqual([]);
    answer = questsFixtures.weekWithLastWeeksCrate;
    showVisitor({ ...shellFixtures.memberWithQuests });

    expect(within(waitingCard("2026-10-05")).getByRole("button", { name: "Claim" })).toHaveFocus();
  });
});

function waitingGroupCard(week: string) {
  return within(within(main()).getByRole("region", { name: "Waiting to open" }))
    .getAllByRole("article")
    .find((card) => card.querySelector(`time[datetime="${week}"]`) !== null && within(card).queryByText("Ants quest") !== null)!;
}

describe("#517: ?crate=group:{week} lands on an earlier week's waiting group crate", () => {
  it.each(["2026-10-05", "2026-09-28"])("scrolls to %s's group crate and focuses its Claim, never opening it", (week) => {
    const scrolled = watchScrolling();
    const { actions } = showQuestsAt(`/quests?crate=group%3A${week}`, questsFixtures.weekWithTwoWeeksOfGroupCrates);

    const card = waitingGroupCard(week);
    expect(scrolled).toEqual([card]);
    expect(within(card).getByRole("button", { name: "Claim" })).toHaveFocus();
    expect(actions.openQuestCrate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["a group crate already opened", "/quests?crate=group:2026-09-21"],
    ["a broken target", "/quests?crate=group:last-week"],
    ["a target with no week", "/quests?crate=group:"],
  ])("lands on the plain page for %s", (_, path) => {
    const scrolled = watchScrolling();
    showQuestsAt(path, questsFixtures.weekWithTwoWeeksOfGroupCrates);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });
});

describe("#435: a target waits out a connecting read", () => {
  it("lands /skills?perk= once the tree answers after connecting", () => {
    preferWideScreen();
    const scrolled = watchScrolling();
    visit("/skills?perk=circle");
    let answer: SkillTreeShown | undefined;
    const read: SkillTreeRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(withTheTree, undefined, undefined, undefined, undefined, read);
    answer = { kind: "connecting" };
    showVisitor({ ...withTheTree });
    expect(scrolled).toEqual([]);
    answer = skillTreeFixtures.withPoints;
    showVisitor({ ...withTheTree });

    expect(scrolled).toEqual([perkNode("Circle")]);
    expect(perkNode("Circle")).toHaveFocus();
  });

  it("lands /quests?quest= once the quests answer after connecting", () => {
    const scrolled = watchScrolling();
    visit("/quests?quest=1");
    let answer: QuestsShown | undefined;
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(shellFixtures.memberWithQuests, undefined, undefined, read);
    answer = { kind: "connecting" };
    showVisitor({ ...shellFixtures.memberWithQuests });
    expect(scrolled).toEqual([]);
    answer = questsFixtures.week;
    showVisitor({ ...shellFixtures.memberWithQuests });

    const goal = questsFixtures.week.slots[1]!.goal;
    expect(within(main()).getByRole("heading", { name: goal })).toHaveFocus();
  });

  it("lands /?crate=journey once the home's reads answer after connecting", () => {
    const scrolled = watchScrolling();
    visit("/?crate=journey");
    let answer: QuestsShown | undefined = { kind: "connecting" };
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(shellFixtures.memberWithQuests, undefined, undefined, read);
    expect(scrolled).toEqual([]);
    answer = questsFixtures.week;
    showVisitor({ ...shellFixtures.memberWithQuests });

    const step = within(within(main()).getByRole("region", { name: "Journey" })).getByRole("heading", { name: "Finish a weekly quest." }).closest("li")!;
    expect(within(step).getByRole("button", { name: "Open" })).toHaveFocus();
  });
});

describe("#435: a quest or perk target waits for its page's content", () => {
  it("lands /quests?quest= once Quests turn from ready to open", () => {
    const scrolled = watchScrolling();
    visit("/quests?quest=1");
    let answer: QuestsShown = questsFixtures.ready;
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(shellFixtures.memberWithTheQuestsReady, undefined, undefined, read);
    expect(scrolled).toEqual([]);
    answer = questsFixtures.week;
    showVisitor(shellFixtures.memberWithTheQuestsOpened);

    const goal = questsFixtures.week.slots[1]!.goal;
    expect(within(main()).getByRole("heading", { name: goal })).toHaveFocus();
  });

  it("lands /skills?perk= once the Skill tree turns from ready to open", () => {
    preferWideScreen();
    const scrolled = watchScrolling();
    visit("/skills?perk=circle");
    let answer: SkillTreeShown = skillTreeFixtures.ready;
    const read: SkillTreeRead = (asking) => (asking ? answer : undefined);
    const { showVisitor } = renderApp(shellFixtures.memberWithTheSkillTreeReady, undefined, undefined, undefined, undefined, read);
    expect(scrolled).toEqual([]);
    answer = skillTreeFixtures.withPoints;
    showVisitor(withTheTree);

    expect(scrolled).toEqual([perkNode("Circle")]);
    expect(perkNode("Circle")).toHaveFocus();
  });
});

describe("#435: a target survives sign-in", () => {
  it.each(["/skills?perk=spark", "/quests?crate=quests", "/?crate=journey", "/book?crate=book", "/leaderboard?period=month&crate=leaderboard", "/quests?crate=weekly%3A2026-10-05%3A0", "/quests?crate=group%3A2026-10-05", "/?panel=inventory", "/settings?section=group"])("signs in back to %s", async (path) => {
    visit(path);
    const { actions, user } = renderApp(shellFixtures.signedOut);
    await user.click(screen.getByRole("button", { name: "Sign in with Slack" }));
    expect(actions.signIn).toHaveBeenCalledWith(path);
  });
});

describe("#435: axe finds no violations on a landing", () => {
  const landings: { name: string; render: () => void; wide?: boolean }[] = [
    { name: "a perk on a wide screen", render: () => showTreeAt("/skills?perk=circle", skillTreeFixtures.withPoints), wide: true },
    { name: "a perk's drawer", render: () => showTreeAt("/skills?perk=rhythm", skillTreeFixtures.withPoints) },
    { name: "a ready crate", render: () => readyPages[0]!.reads((visit(readyPages[0]!.path), readyPages[0]!.member)) },
    { name: "a Journey crate", render: () => (visit("/?crate=journey"), renderApp(shellFixtures.memberWithQuests)) },
    { name: "an earlier week's crate", render: () => showQuestsAt("/quests?crate=weekly:2026-10-05:0", questsFixtures.weekWithLastWeeksCrate) },
    { name: "an earlier week's group crate", render: () => showQuestsAt("/quests?crate=group:2026-10-05", questsFixtures.weekWithTwoWeeksOfGroupCrates) },
  ];

  it.each(landings.flatMap((landing) => [false, true].map((dark) => ({ ...landing, dark, mode: dark ? "dark" : "light" }))))("$name in $mode mode", async ({ render, wide, dark }) => {
    fakeSystemTheme(dark);
    if (wide) preferWideScreen();
    render();
    const { violations } = await axe.run(document.body);
    expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

describe("#469: ?crate=bought:{n} lands on that bought crate's Open and ?crate=store on Buy a crate, never opening or buying", () => {
  const shopper = { ...shellFixtures.memberWithTheInventory, coins: 120 };
  const twoWaiting: Collection = { ...collectionFixtures.withTheStore, hoggies: collectionFixtures.withTheStore.hoggies.slice(0, 6), crests: undefined };

  function showTheCollectionAt(path: string, collection: Collection = twoWaiting) {
    visit(path);
    return renderApp(shopper, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, fixedCollection(collection));
  }

  function crateRow(crate: string) {
    return main().querySelector<HTMLElement>(`[data-crate-target="${crate}"]`)!;
  }

  it("scrolls the crate into view and focuses its Open once the collection lands", () => {
    const scrolled = watchScrolling();
    const { actions } = showTheCollectionAt("/book/collection?crate=bought%3A2");

    const open = within(crateRow("bought:2")).getByRole("button", { name: "Open" });
    expect(scrolled).toEqual([crateRow("bought:2")]);
    expect(open).toHaveFocus();
    expect(actions.openCrate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).toBe("?crate=bought%3A2");
  });

  it.each([
    ["a crate already opened", "/book/collection?crate=bought:3"],
    ["a broken target", "/book/collection?crate=bought:"],
  ])("leaves the plain page for %s", (_, path) => {
    const scrolled = watchScrolling();
    showTheCollectionAt(path);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("?crate=store scrolls to the offer and focuses Buy a crate, never buying", () => {
    const scrolled = watchScrolling();
    const { actions } = showTheCollectionAt("/book/collection?crate=store");

    const buy = within(main()).getByRole("button", { name: "Buy a crate · 50 coins" });
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]!.contains(buy)).toBe(true);
    expect(buy).toHaveFocus();
    expect(actions.buyCrate).not.toHaveBeenCalled();
    expect(actions.openCrate).not.toHaveBeenCalled();
  });

  it("?crate=store focuses a Buy held short of coins too, still never buying", () => {
    visit("/book/collection?crate=store");
    const { actions } = renderApp({ ...shopper, coins: 20 }, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, fixedCollection(twoWaiting));

    const buy = within(main()).getByRole("button", { name: "Buy a crate · 50 coins" });
    expect(buy).toHaveFocus();
    expect(buy).toHaveAttribute("aria-disabled", "true");
    expect(actions.buyCrate).not.toHaveBeenCalled();
  });

  it("leaves the plain page for ?crate=store while the answer carries no offer", () => {
    const scrolled = watchScrolling();
    showTheCollectionAt("/book/collection?crate=store", { ...twoWaiting, crateStore: null });

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("lands once the collection answers after loading", () => {
    const scrolled = watchScrolling();
    visit("/book/collection?crate=bought%3A1");
    let landed = false;
    const { showVisitor } = renderApp(shopper, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder), undefined, undefined, undefined, undefined, undefined, undefined, (asking) => (asking && landed ? twoWaiting : undefined));
    expect(scrolled).toEqual([]);
    landed = true;
    showVisitor({ ...shopper });

    expect(within(crateRow("bought:1")).getByRole("button", { name: "Open" })).toHaveFocus();
  });
});

describe("#531: ?panel=inventory and ?section={section} land on their heading, never acting", () => {
  const withSettings = shellFixtures.memberWithSettings;

  function heading(name: string) {
    return within(main()).getByRole("heading", { level: 2, name });
  }

  function regionOf(name: string) {
    return within(main()).getByRole("region", { name });
  }

  function showSettingsAt(path: string, settings: MySettings = settingsFixtures.everything) {
    visit(path);
    return renderApp(withSettings, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fixedSettings(settings));
  }

  function expectNothingSent(actions: ReturnType<typeof renderApp>["actions"]) {
    for (const command of [actions.buyItem, actions.setBoardVisibility, actions.setMessageSetting, actions.pickPrimaryGroup, actions.openFeature, actions.openQuestCrate]) expect(command).not.toHaveBeenCalled();
  }

  it("/?panel=inventory scrolls the Inventory into view and focuses its heading", () => {
    const scrolled = watchScrolling();
    visit("/?panel=inventory");
    const { actions } = renderApp(shellFixtures.memberWithTheInventory);

    expect(scrolled).toEqual([regionOf("Inventory")]);
    expect(heading("Inventory")).toHaveFocus();
    expect(within(regionOf("Inventory")).getByRole("region", { name: "Kudos emoji" })).toBeInTheDocument();
    expectNothingSent(actions);
    expect(window.location.search).toBe("?panel=inventory");
  });

  it("lands on the Inventory again when history returns to the link", () => {
    visit("/?panel=inventory");
    renderApp(shellFixtures.memberWithTheInventory);
    act(() => {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const scrolled = watchScrolling();
    act(() => {
      window.history.pushState(null, "", "/?panel=inventory");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(scrolled).toEqual([regionOf("Inventory")]);
    expect(heading("Inventory")).toHaveFocus();
  });

  it("keeps a purchase in flight when the address leaves the link", async () => {
    let answer: (reply: ItemBuyAnswer) => void = () => undefined;
    visit("/?panel=inventory");
    const { user } = renderApp(shellFixtures.memberWithTheInventory, undefined, { buyItem: () => new Promise((settle) => (answer = settle)) });
    await user.click(within(regionOf("Inventory")).getByRole("button", { name: "Buy for 100 coins, Gem" }));
    act(() => {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(within(regionOf("Inventory")).getByRole("button", { name: "Buying…, Gem" })).toBeInTheDocument();
    await act(async () => answer({ kind: "bought", item: "gem" }));
    expect(within(regionOf("Inventory")).queryByRole("button", { name: "Buying…, Gem" })).not.toBeInTheDocument();
  });

  it.each([
    ["a member without an inventory", "/?panel=inventory", shellFixtures.memberWithTheBoard],
    ["an unknown panel", "/?panel=nope", shellFixtures.memberWithTheInventory],
  ])("leaves the plain home for %s", (_, path, member) => {
    const scrolled = watchScrolling();
    visit(path);
    renderApp(member);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it.each([
    ["visibility", "Leaderboards"],
    ["messages", "Messages"],
    ["group", "Your group"],
  ])("/settings?section=%s scrolls the %s section into view and focuses its heading", (section, name) => {
    const scrolled = watchScrolling();
    const { actions } = showSettingsAt(`/settings?section=${section}`);

    expect(scrolled).toEqual([regionOf(name)]);
    expect(heading(name)).toHaveFocus();
    expectNothingSent(actions);
    expect(window.location.search).toBe(`?section=${section}`);
  });

  it.each([
    ["a hidden section", "/settings?section=group", { ...settingsFixtures.everything, group: null }],
    ["an unknown section", "/settings?section=nope", settingsFixtures.everything],
  ])("leaves the plain settings page for %s", (_, path, settings) => {
    const scrolled = watchScrolling();
    showSettingsAt(path, settings);

    expect(scrolled).toEqual([]);
    expect(document.body).toHaveFocus();
  });

  it("lands once the settings answer after loading", () => {
    const scrolled = watchScrolling();
    visit("/settings?section=messages");
    let landed = false;
    const { showVisitor } = renderApp(withSettings, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, (asking) => (asking && landed ? settingsFixtures.everything : undefined));
    expect(scrolled).toEqual([]);
    landed = true;
    showVisitor({ ...withSettings });

    expect(scrolled).toEqual([regionOf("Messages")]);
    expect(heading("Messages")).toHaveFocus();
  });
});
