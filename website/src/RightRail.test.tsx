import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardAnswer, BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import type { QuestsRead, QuestsShown } from "./questsRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedProfileCard, profileCardFixtures } from "./profileCardFixtures";
import type { ProfileCardRead, ProfileCardShown } from "./profileCardRead";
import { shellFixtures, type Leaderboard, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

const everyPanelOpen = shellFixtures.memberWithEveryPanelOpen;

function main() {
  return screen.getByRole("main");
}

function panel(name: string) {
  return within(main()).getByRole("region", { name });
}

function queryPanel(name: string) {
  return within(main()).queryByRole("region", { name });
}

function linksIn(region: HTMLElement) {
  return within(region)
    .queryAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

function railOf(member: MemberProfile, { board, quests }: { board?: BoardRead; quests?: QuestsRead } = {}) {
  return renderApp(member, board, undefined, quests);
}

function showingQuests(answer: QuestsShown | undefined, member: MemberProfile = everyPanelOpen) {
  return railOf(member, { quests: (asking) => (asking ? answer : undefined) });
}

function showingBoard(answer: BoardAnswer | undefined, member: MemberProfile = everyPanelOpen) {
  return railOf(member, { board: (period) => (period === undefined ? undefined : answer) });
}

function standingOn(board: Leaderboard) {
  railOf(everyPanelOpen, { board: fixedLeaderboard(board) });
  return panel("Where you stand");
}

describe("WS107: What teammates see", () => {
  it("labels the member's raised profile card as public, with their face, name and level, and what stays with them", () => {
    railOf(shellFixtures.memberAtLevel7);
    const card = panel("What teammates see");
    expect(card).toHaveTextContent("Public");
    expect(within(card).getByText("SE")).toBeInTheDocument();
    expect(within(card).getByText("Sam Example")).toHaveClass("font-semibold");
    expect(within(card).getByText("Lv 7")).toBeInTheDocument();
    expect(card).toHaveTextContent("Everyone can see this card. Your XP and the kudos you receive stay with you.");
  });

  it("shows no received count, team or medals, and no level while progression is absent", () => {
    railOf(shellFixtures.member);
    const card = panel("What teammates see");
    expect(card.textContent).not.toMatch(/\d|Lv|\bteam\b|medal/i);
  });
});

function cardShowing(answer: ProfileCardShown | undefined, member: MemberProfile = everyPanelOpen) {
  renderApp(member, undefined, undefined, undefined, undefined, undefined, (asking) => (asking ? answer : undefined));
  return panel("What teammates see");
}

function medalsOn(card: HTMLElement) {
  return within(card)
    .getAllByRole("listitem")
    .map((medal) => ({ words: within(medal).getAllByText(/.+/).map((word) => word.textContent), metal: medal.querySelector("[data-medal='earned'] circle")?.getAttribute("fill") }));
}

const beforeTheBookOpens = "Medals join this card only after you open the Book.";

describe("WS343 V16: the public card's best medals, as teammates see them in Slack", () => {
  it("lists the card's best four medals best first, each in its tier's metal with the tier's word beside its name", () => {
    const card = cardShowing(profileCardFixtures.bestFour);
    expect(within(card).getByRole("list", { name: "Best medals" })).toBeInTheDocument();
    expect(medalsOn(card)).toEqual([
      { words: ["Patron of Praise", "Diamond"], metal: "var(--medal-diamond)" },
      { words: ["Highly Valued", "Gold"], metal: "var(--medal-gold)" },
      { words: ["Connector", "Silver"], metal: "var(--medal-silver)" },
      { words: ["Regular", "Bronze"], metal: "var(--medal-bronze)" },
    ]);
  });

  it("lists only the medals the card has", () => {
    const card = cardShowing(profileCardFixtures.twoMedals);
    expect(medalsOn(card).map(({ words }) => words[0])).toEqual(["Highly Valued", "Regular"]);
  });

  it("shows no medal list and no line about medals while the opened Book's card has none", () => {
    const card = cardShowing(profileCardFixtures.noMedals);
    expect(within(card).queryByRole("list")).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/medal/i);
  });

  it("keeps the card as it was, with no medals, while the profile card hasn't shipped to the member", () => {
    const card = cardShowing(profileCardFixtures.notFound, shellFixtures.memberWaitingForTheBook);
    expect(within(card).queryByRole("list")).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/medal/i);
    expect(card).toHaveTextContent("Everyone can see this card. Your XP and the kudos you receive stay with you.");
  });

  it("marks the card busy while the card read loads", () => {
    const card = cardShowing(undefined);
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).not.toHaveTextContent(/medal/i);
  });

  it("says the medals didn't load when the card read fails, instead of showing a card without them", () => {
    const card = cardShowing({ kind: "broken" });
    expect(card).not.toHaveAttribute("aria-busy");
    expect(within(card).queryByRole("list")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Your medals didn't load.");
  });

  it.each([
    ["locked", shellFixtures.memberWaitingForTheBook],
    ["ready", shellFixtures.memberWithTheBookReady],
  ])("says medals join the card only after the Book opens, while the Book is %s", (_, member) => {
    const card = cardShowing(profileCardFixtures.noMedals, member);
    expect(within(card).queryByRole("list")).not.toBeInTheDocument();
    expect(card).toHaveTextContent(beforeTheBookOpens);
  });

  it.each([
    ["the Book hasn't shipped", shellFixtures.memberWithNothingShipped],
    ["unlocks don't apply", { ...everyPanelOpen, features: null }],
  ])("says nothing about medals while %s", (_, member) => {
    const card = cardShowing(profileCardFixtures.noMedals, member);
    expect(card).not.toHaveTextContent(/medal/i);
  });

  it("asks for the card only on the home", async () => {
    const read = vi.fn<ProfileCardRead>(fixedProfileCard(profileCardFixtures.bestFour));
    window.history.replaceState(null, "", "/leaderboard");
    renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard), undefined, undefined, undefined, undefined, read);
    expect(read).toHaveBeenCalled();
    expect(read).not.toHaveBeenCalledWith(true);
  });
});

describe("WS108: the recent-kudos slot renders nothing and leaves no gap", () => {
  it("puts the Quests panel directly after What teammates see, then the Leaderboard panel", () => {
    railOf(everyPanelOpen, { quests: fixedQuests(questsFixtures.week), board: fixedLeaderboard(leaderboardFixtures.midBoard) });
    const card = panel("What teammates see");
    expect(card.nextElementSibling).toBe(panel("Quests this week"));
    expect(panel("Quests this week").nextElementSibling).toBe(panel("Where you stand"));
  });
});

describe("WS109 WS315 WS316: Quests this week", () => {
  function questsPanel() {
    showingQuests(questsFixtures.week);
    return panel("Quests this week");
  }

  it("is a game object labelled with the weekly turnover, with a row per slot in slot order and See all quests", () => {
    const quests = questsPanel();
    expect(quests).toHaveClass("hud-panel");
    expect(quests).toHaveTextContent("New quests every Monday.");
    expect(linksIn(quests)).toEqual([
      ["Thank someone and say why, 3 times.", "/quests"],
      ["Thank someone you haven't thanked before. Claim", "/quests?quest=1"],
      ["Thank someone you haven't thanked in the last 30 days.", "/quests"],
      ["See all quests", "/quests"],
    ]);
  });

  it("shows a quest in progress as a neutral progress bar named by its goal, with done over target", () => {
    const quests = questsPanel();
    const bar = within(quests).getByRole("progressbar", { name: "Thank someone and say why, 3 times." });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(bar.firstElementChild).toHaveClass("bg-muted-foreground");
    expect(within(quests).getAllByRole("progressbar")).toHaveLength(1);
    expect(quests).toHaveTextContent("1/3");
  });

  it("lets a finished quest read Claim and link to its own card, and an opened quest show a check and Claimed, as /quests does", () => {
    const quests = questsPanel();
    expect(within(quests).getByRole("link", { name: "Thank someone you haven't thanked before. Claim" })).toHaveAttribute("href", "/quests?quest=1");
    expect(quests).not.toHaveTextContent("Reward ready");
    expect(quests).not.toHaveTextContent("Done");
    expect(within(quests).getByText("Claimed")).toBeInTheDocument();
    expect(within(quests).queryByRole("button")).not.toBeInTheDocument();
  });

  it("E076 WS317: ends with the Journey's next step as a row tagged New, linking to its card on /quests", () => {
    showingQuests(questsFixtures.weekWithABonus);
    const quests = panel("Quests this week");
    expect(linksIn(quests)).toEqual([
      ["Thank someone and say why, 3 times.", "/quests"],
      ["Thank someone you haven't thanked before. Claim", "/quests?quest=1"],
      ["Thank someone you haven't thanked in the last 30 days.", "/quests"],
      ["Thank someone you haven't thanked before. New", "/quests?quest=journey"],
      ["See all quests", "/quests"],
    ]);
  });

  it("WS315 E076: keeps New on a finished bonus row and reads Claim beside it", () => {
    showingQuests(questsFixtures.weekWithAFinishedBonus);
    const quests = panel("Quests this week");
    expect(within(quests).getByRole("link", { name: "Finish a weekly quest. New Claim" })).toHaveAttribute("href", "/quests?quest=journey");
  });

  it("WS317: shows the bonus row in a week with nothing drawn", () => {
    showingQuests({ ...questsFixtures.noDraw, bonus: questsFixtures.weekWithABonus.bonus });
    const quests = panel("Quests this week");
    expect(within(quests).getByRole("link", { name: "Thank someone you haven't thanked before. New" })).toHaveAttribute("href", "/quests?quest=journey");
  });

  it("shows no XP, swap or waiting crates, which /quests shows", () => {
    showingQuests(questsFixtures.weekWithLastWeeksCrate);
    const quests = panel("Quests this week");
    expect(quests.textContent).not.toMatch(/XP|Swap|Waiting|Week of/);
  });

  it("shows an empty week as Max's compact line with an outline Thank someone in Slack", () => {
    showingQuests(questsFixtures.noDraw);
    const quests = panel("Quests this week");
    expect(quests).toHaveTextContent("No quests this week yet. New quests arrive every Monday.");
    const thank = within(quests).getByRole("link", { name: /Thank someone in Slack/ });
    expect(thank).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(thank).toHaveClass("quill-button--variant-outline");
    expect(within(quests).queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("WS110: Where you stand", () => {
  it("names the Everyone row by the viewer's rank and links it to the leaderboard, under This week", () => {
    const standing = standingOn(leaderboardFixtures.midBoard);
    expect(standing).toHaveTextContent("This week");
    expect(within(standing).getByRole("link", { name: "Everyone this week: you're #9" })).toHaveAttribute("href", "/leaderboard");
    expect(within(standing).getByText("#9")).toHaveClass("font-semibold", "tabular-nums");
    expect(standing).toHaveTextContent("Everyone");
    expect(standing).toHaveTextContent("The whole company on one board");
    expect(within(standing).getByRole("link", { name: "Open the leaderboard" })).toHaveAttribute("href", "/leaderboard");
  });

  it("gives the faces above, at and below the viewer their words, and rings the viewer's face with a label", () => {
    const standing = standingOn(leaderboardFixtures.midBoard);
    const neighbours = within(standing).getByRole("list", { name: "Your neighbours on the board" });
    expect(within(neighbours).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Above you: Hal Sato, 12 kudos given"),
      expect.stringContaining("You: 11 kudos given"),
      expect.stringContaining("Below you: Ivy Quinn, 10 kudos given"),
    ]);
    expect(neighbours.querySelectorAll("[data-you-ring]")).toHaveLength(1);
    expect(within(neighbours).getByText("You")).toBeInTheDocument();
  });

  it("says tied under the rank when the viewer's row is tied", () => {
    const standing = standingOn(leaderboardFixtures.tiedBelowTheLead);
    expect(within(standing).getByRole("link", { name: "Everyone this week: you're tied at #2" })).toBeInTheDocument();
    expect(within(standing).getByText("tied")).toBeInTheDocument();
  });

  it("leaves the place above empty at the top of the board, and the place below empty at the bottom", () => {
    const top = standingOn(leaderboardFixtures.viewerLeads);
    expect(top.textContent).not.toMatch(/Above you/);
    expect(top).toHaveTextContent("Below you: Ada Lindqvist, 8 kudos given");
  });

  it("leaves the place below empty at the bottom of the board", () => {
    const bottom = standingOn(leaderboardFixtures.longBoardViewerAtTheBottom);
    expect(bottom).toHaveTextContent("Above you: Teammate 29, 71 kudos given");
    expect(bottom.textContent).not.toMatch(/Below you/);
  });

  it("shows a neighbour's Slack picture, and their initials once it fails to load", () => {
    const standing = standingOn(leaderboardFixtures.withTeammatesFaces);
    const picture = standing.querySelector("img")!;
    expect(picture).toHaveAttribute("src", "https://secure.gravatar.com/avatar/ivy.jpg?s=192");
    fireEvent.error(picture);
    expect(standing.querySelector("img")).toBeNull();
    expect(within(standing).getByText("IQ")).toBeInTheDocument();
  });

  it.each([
    ["isn't ranked", leaderboardFixtures.notRanked, "Give kudos this week to join the board."],
    ["left the boards", leaderboardFixtures.left, 'You\'re off the board by choice. Switch on "Show me on the leaderboards" to come back.'],
  ])("uses the page's own line for a viewer who %s, with no rank or faces", (_, board, line) => {
    const standing = standingOn(board);
    expect(standing).toHaveTextContent(line);
    expect(standing.textContent).not.toMatch(/#\d|kudos given/);
    expect(within(standing).getByRole("link", { name: "Open the leaderboard" })).toBeInTheDocument();
  });

  it("asks the board for this week, with its group boards, only while the Leaderboard is open", () => {
    const asked = vi.fn<BoardRead>(() => undefined);
    const { showVisitor } = railOf(shellFixtures.memberWithEveryPanelLocked, { board: asked });
    expect(asked.mock.calls.map(([period]) => period).filter((period) => period !== undefined)).toEqual([]);
    showVisitor(everyPanelOpen);
    expect(asked).toHaveBeenLastCalledWith("week", true);
  });
});

describe("WS344: My group and Groups in Where you stand", () => {
  function rowLinks(standing: HTMLElement) {
    return within(standing)
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label") ?? link.textContent);
  }

  function neighboursOf(standing: HTMLElement, list: string) {
    return within(within(standing).getByRole("list", { name: list }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
  }

  it("lists My group, Groups and Everyone in E's order, each a door to the leaderboard", () => {
    const standing = standingOn(leaderboardFixtures.withGroupBoards);
    expect(rowLinks(standing)).toEqual(["My group this week: you're #1, up 2 places", "Groups this week: your group is #2, up 1 place", "Everyone this week: you're #9", "Open the leaderboard"]);
    expect(within(standing).getByRole("link", { name: "Groups this week: your group is #2, up 1 place" })).toHaveAttribute("href", "/leaderboard");
    expect(standing).toHaveTextContent("Team Ants");
    expect(standing).toHaveTextContent("Kudos per person");
  });

  it("gives My group's faces their words, with the places the viewer climbed under the rank", () => {
    const standing = standingOn(leaderboardFixtures.withGroupBoards);
    expect(neighboursOf(standing, "Your neighbours in Team Ants")).toEqual([expect.stringContaining("You: 4 kudos given"), expect.stringContaining("Below you: Ada Lindqvist, 2 kudos given")]);
    const myGroup = within(standing).getByRole("link", { name: "My group this week: you're #1, up 2 places" });
    expect(myGroup).toHaveTextContent("▲ 2");
  });

  it("shows the groups around the viewer's group as crests with their kudos per person, ringing their own", () => {
    const standing = standingOn(leaderboardFixtures.withGroupBoards);
    const groups = within(standing).getByRole("list", { name: "The groups around yours" });
    expect(neighboursOf(standing, "The groups around yours")).toEqual([
      expect.stringContaining("Above your group: Thistle, 3.2 kudos given per person"),
      expect.stringContaining("Your group: Team Ants, 2.0 kudos given per person"),
      expect.stringContaining("Below your group: Bees, 0.8 kudos given per person"),
    ]);
    expect(groups.querySelectorAll("[data-crest]")).toHaveLength(3);
    expect(groups.querySelectorAll("[data-mine-ring]")).toHaveLength(1);
  });

  it("says tied under the group's rank when it shares it", () => {
    const standing = standingOn(leaderboardFixtures.withMyGroupTiedOnGroups);
    expect(within(standing).getByRole("link", { name: "Groups this week: your group is tied at #2, up 1 place" })).toBeInTheDocument();
  });

  it.each([
    ["no group", leaderboardFixtures.withGroupsAndNoGroupOfMine, "No group yet"],
    ["a group that isn't listed", leaderboardFixtures.withMyGroupUnlisted, "Not listed yet"],
  ])("says the board card's words on the Groups row for a viewer with %s, with no rank", (_, board, words) => {
    const standing = standingOn(board);
    const groupsRow = within(standing).getByText("Groups").closest("li")!;
    expect(groupsRow).toHaveTextContent(words);
    expect(groupsRow.textContent).not.toMatch(/#\d|per person,/);
  });

  it("asks a viewer whose group is unlisted and who gave nothing to give kudos, on the My group row", () => {
    const standing = standingOn(leaderboardFixtures.withMyGroupUnlisted);
    const myGroupRow = within(standing).getByText("My group").closest("li")!;
    expect(myGroupRow).toHaveTextContent("Give kudos this week to join the board.");
  });

  it("shows only Everyone while the group boards don't apply", () => {
    const standing = standingOn(leaderboardFixtures.midBoard);
    expect(rowLinks(standing)).toEqual(["Everyone this week: you're #9", "Open the leaderboard"]);
  });

  it("keeps only the Groups row and says the viewer is hidden while they left the boards and their group still ranks", () => {
    const standing = standingOn(leaderboardFixtures.leftWhileMyGroupRanks);
    expect(rowLinks(standing)).toEqual(["Groups this week: your group is #2, up 1 place", "Open the leaderboard"]);
    expect(standing).toHaveTextContent("You're hidden from leaderboards");
    expect(standing).toHaveTextContent("You're off My group and Everyone. Groups still shows your group.");
    expect(within(standing).queryByText("My group")).not.toBeInTheDocument();
    expect(within(standing).queryByText("Everyone")).not.toBeInTheDocument();
  });

  it("uses the page's own line, with no hidden note, while the viewer left the boards and their group doesn't rank", () => {
    const standing = standingOn(leaderboardFixtures.leftWhileMyGroupIsUnlisted);
    expect(standing).not.toHaveTextContent("You're hidden from leaderboards");
    expect(standing).toHaveTextContent('You\'re off the board by choice. Switch on "Show me on the leaderboards" to come back.');
  });
});

describe("WS344 GB16: the peer line in Where you stand", () => {
  it("says how much of their group the viewer improved more than", () => {
    const standing = standingOn(leaderboardFixtures.withAPeerLine);
    expect(standing).toHaveTextContent("You improved more than 60% of Team Ants.");
  });

  it("says everyone else, never more than 100%, while the viewer improved more than their whole group", () => {
    const standing = standingOn(leaderboardFixtures.aheadOfTheWholeGroup);
    expect(standing).toHaveTextContent("You improved more than everyone else in Team Ants.");
    expect(standing).not.toHaveTextContent("100%");
  });

  it("says nothing without a peer line", () => {
    expect(standingOn(leaderboardFixtures.withGroupBoards)).not.toHaveTextContent("You improved");
  });
});

describe("WS344 GB32: the public card names the member's primary group", () => {
  it("shows the group in muted text under the name", () => {
    const card = cardShowing(profileCardFixtures.inAGroup);
    const group = within(card).getByText("Team Ants");
    expect(group).toHaveClass("text-muted-foreground");
    expect(within(card).getByText("Sam Example").compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no group line while the card has none", () => {
    const card = cardShowing(profileCardFixtures.bestFour);
    expect(card).not.toHaveTextContent("Team Ants");
  });
});

describe("WS111: every answer has one rendering", () => {
  const panels = [
    { name: "Quests this week", feature: "Quests", show: showingQuests, link: ["See all quests", "/quests"], locked: { kind: "locked", level: 2 } as const, showOpen: () => showingQuests(questsFixtures.week), row: "Thank someone and say why, 3 times." },
    { name: "Where you stand", feature: "Leaderboard", show: showingBoard, link: ["Open the leaderboard", "/leaderboard"], locked: { kind: "locked", level: 3 } as const, showOpen: () => showingBoard(leaderboardFixtures.midBoard), row: "Above you: Hal Sato, 12 kudos given" },
  ];

  describe.each(panels)("$name", ({ name, feature, show, link, locked, showOpen, row }) => {
    it("shows its label busy, with no rows, until the read answers", () => {
      show(undefined);
      const busy = panel(name);
      expect(busy).toHaveAttribute("aria-busy", "true");
      expect(within(busy).queryAllByRole("link")).toEqual([]);
    });

    it("lets the frame say Can't reach HedgeHug once the socket has stayed unconnected without an answer, as on every page", () => {
      show({ kind: "connecting" });
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Can't reach HedgeHug");
      expect(queryPanel(name)).toBeNull();
    });

    it("shows the locked panel from the read's own answer while getMyProfile catches up", () => {
      show(locked);
      expect(queryPanel(name)).toBeNull();
      expect(panel(feature)).toHaveTextContent(`Unlocks at level ${locked.level}`);
    });

    it("shows the ready panel's crate from the read's own answer while getMyProfile catches up", () => {
      show({ kind: "ready" });
      expect(within(panel(feature)).getByRole("button", { name: "Open" })).toBeInTheDocument();
    });

    it.each([["not-found", { kind: "not-found" } as const], ["a denial", { kind: "not-a-member" } as const]])("renders nothing for %s", (_, answer) => {
      show(answer);
      expect(queryPanel(name)).toBeNull();
      expect(queryPanel(feature)).toBeNull();
    });

    it("keeps only its link to the page when the read fails", () => {
      show({ kind: "broken" });
      expect(linksIn(panel(name))).toEqual([link]);
      expect(panel("What teammates see")).toBeInTheDocument();
    });

    it("clears its rows on sign-out", () => {
      const { showVisitor } = showOpen();
      expect(panel(name)).toHaveTextContent(row);
      showVisitor(shellFixtures.signedOut);
      expect(screen.queryByRole("region", { name })).toBeNull();
      expect(document.body).not.toHaveTextContent(row);
    });
  });

  it("says the Leaderboard is ready in Slack when the board answers ready while unlocks don't apply, with no crate to open", () => {
    showingBoard({ kind: "ready" }, shellFixtures.memberWithTheBoard);
    const ready = panel("Leaderboard");
    expect(ready).toHaveTextContent("Leaderboard is ready for you. Open it in Slack's App Home.");
    expect(within(ready).queryByRole("button")).not.toBeInTheDocument();
  });

  it("follows getMyProfile, never getQuests, for the panel's state", () => {
    railOf(shellFixtures.memberWithEveryPanelLocked, { quests: fixedQuests(questsFixtures.week) });
    expect(queryPanel("Quests this week")).toBeNull();
    expect(panel("Quests")).toHaveTextContent("Unlocks at level 2");
  });
});
