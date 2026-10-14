import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import type { RecentKudosRead, RecentKudosShown } from "./recentKudosRead";
import { shellFixtures, type KudosGiven, type Person, type RecentKudos } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T18:00:00"));
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

const { threeReceived, threeGiven, nothingYet } = recentKudosFixtures;

function homeWith(read: RecentKudosRead) {
  return renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, read);
}

function homeAnswering(received: RecentKudosShown | undefined, given: RecentKudosShown | undefined = threeGiven) {
  return homeWith(fixedRecentKudos({ received, given }));
}

function card() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Recent kudos" });
}

function queryCard() {
  return within(screen.getByRole("main")).queryByRole("region", { name: "Recent kudos" });
}

function panel(name: string) {
  return within(screen.getByRole("main")).getByRole("region", { name });
}

function rows() {
  return within(card()).getAllByRole("listitem");
}

function rowAt(index: number) {
  const row = rows()[index];
  if (row === undefined) throw new Error(`The card has no row ${index}.`);
  return row;
}

function headlinesOf() {
  return rows().map((row) => within(row).getByTestId("recent-kudos-headline").textContent);
}

function switchOption(name: "Received" | "Given") {
  return within(card()).getByRole("radio", { name });
}

function firstOf<Entry extends RecentKudos["entries"][number]>(answer: { entries: Entry[] }): Entry {
  const [first] = answer.entries;
  if (first === undefined) throw new Error("The answer has no entries.");
  return first;
}

function person(name: string): Person {
  return { name, face: { kind: "initials", initials: name.slice(0, 2).toUpperCase() } };
}

function givenTo(names: string[]): RecentKudos {
  const first = firstOf(threeGiven);
  if (first.kind !== "kudosGiven") throw new Error("The given fixture starts with a kudos received.");
  const entry: KudosGiven = { ...first, key: names.join(), recipients: names.map(person) };
  return { kind: "recent", entries: [entry] };
}

describe("WS205: the Recent kudos card sits under What teammates see", () => {
  it("puts the card directly after What teammates see and before the Quests panel", () => {
    homeAnswering(threeReceived);

    expect(panel("What teammates see").nextElementSibling).toBe(card());
    expect(card().nextElementSibling).toBe(panel("Quests this week"));
  });
});

describe("WS206: its frame", () => {
  it("is a plain card labelled Recent kudos, private to the member, with no corner marks", () => {
    homeAnswering(threeReceived);

    expect(within(card()).getByRole("heading", { level: 2, name: "Recent kudos" })).toBeInTheDocument();
    expect(card()).toHaveTextContent("Only you see these");
    expect(card()).not.toHaveClass("hud-panel");
  });

  it("selects Received on every load, in a switch with radio semantics", () => {
    const first = homeAnswering(threeReceived);
    expect(within(card()).getByRole("radiogroup", { name: "Show kudos" })).toBeInTheDocument();
    expect(switchOption("Received")).toBeChecked();
    expect(switchOption("Given")).not.toBeChecked();
    first.unmount();

    homeAnswering(threeReceived);
    expect(switchOption("Received")).toBeChecked();
  });

  it("moves between Received and Given with the arrow keys, one always selected", async () => {
    const { user } = homeAnswering(threeReceived);
    switchOption("Received").focus();

    await user.keyboard("{ArrowRight}");
    expect(switchOption("Given")).toBeChecked();
    expect(switchOption("Given")).toHaveFocus();
    expect(switchOption("Received")).not.toBeChecked();
    expect(headlinesOf()[0]).toBe("You thanked Cleo Marchetti");

    await user.keyboard("{ArrowLeft}");
    expect(switchOption("Received")).toBeChecked();
    expect(headlinesOf()[0]).toBe("Ada Lindqvist thanked you");
  });

  it("moves between Received and Given with the up and down arrows too, wrapping at either end", async () => {
    const { user } = homeAnswering(threeReceived);
    switchOption("Received").focus();

    await user.keyboard("{ArrowDown}");
    expect(switchOption("Given")).toBeChecked();
    expect(switchOption("Given")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(switchOption("Received")).toBeChecked();
    expect(switchOption("Received")).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(switchOption("Given")).toBeChecked();
    expect(headlinesOf()[0]).toBe("You thanked Cleo Marchetti");
  });

  it("marks the selected option with a check as well as its colour", async () => {
    const { user } = homeAnswering(threeReceived);
    expect(switchOption("Received").querySelector("[data-selected-mark]")).not.toBeNull();
    expect(switchOption("Given").querySelector("[data-selected-mark]")).toBeNull();

    await user.click(switchOption("Given"));

    expect(switchOption("Given").querySelector("[data-selected-mark]")).not.toBeNull();
    expect(switchOption("Received").querySelector("[data-selected-mark]")).toBeNull();
  });

  it("keeps Given selected when it is clicked again", async () => {
    const { user } = homeAnswering(threeReceived);
    await user.click(switchOption("Given"));
    await user.click(switchOption("Given"));

    expect(switchOption("Given")).toBeChecked();
    expect(switchOption("Received")).not.toBeChecked();
  });

  it("keeps the last rows and the switch in place, busy, while the other direction loads", async () => {
    const { user } = homeWith((direction) => (direction === "received" ? threeReceived : undefined));
    await user.click(switchOption("Given"));

    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(switchOption("Given")).toHaveFocus();
    expect(rows()).toHaveLength(3);
  });
});

describe("WS207: its rows", () => {
  it("lists the kudos received in the read's order, each with the giver's face, who thanked you and when", () => {
    homeAnswering(threeReceived);

    expect(headlinesOf()).toEqual(["Ada Lindqvist thanked you", "Bo Okafor thanked you", "A teammate thanked you"]);
    expect(rowAt(0).querySelector("img")).toHaveAttribute("src", "https://avatars.slack-edge.com/ada_192.png");
    expect(within(rowAt(1)).getByText("BO")).toBeInTheDocument();
    const times = rows().map((row) => row.querySelector("time"));
    expect(times.map((time) => time?.textContent)).toEqual(["Today", "Yesterday", "7 Oct"]);
    expect(times[0]).toHaveAttribute("datetime", new Date(firstOf(threeReceived).at).toISOString());
  });

  it("lists the kudos given with the first recipient's face, up to two more behind it, and who you thanked", async () => {
    const { user } = homeAnswering(threeReceived);
    await user.click(switchOption("Given"));

    expect(headlinesOf()).toEqual(["You thanked Cleo Marchetti", "You thanked Ada Lindqvist and Bo Okafor", "You thanked Ada Lindqvist, Bo Okafor and 3 others"]);
    expect(within(rowAt(0)).getAllByTestId("person-face")).toHaveLength(1);
    expect(within(rowAt(1)).getAllByTestId("person-face")).toHaveLength(2);
    expect(within(rowAt(2)).getAllByTestId("person-face")).toHaveLength(3);
  });

  it("shows the words clamped to two lines, links as text, and Edited after an edited message", () => {
    homeAnswering(threeReceived);

    expect(rowAt(0)).toHaveTextContent("Thanks for pairing on the release checklist, it saved us a whole afternoon 🎉");
    expect(within(rowAt(0)).getByTestId("kudos-message-words")).toHaveClass("line-clamp-2");
    expect(rowAt(1)).toHaveTextContent("The new onboarding doc is so clear. See the doc");
    expect(within(rowAt(1)).getByText("Edited")).toBeInTheDocument();
    expect(within(rowAt(0)).queryByText("Edited")).not.toBeInTheDocument();
    expect(rowAt(2)).toHaveTextContent("The words of this kudos are from before HedgeHug kept them.");
  });

  it("holds no link, XP, quest, Said why tag or channel", async () => {
    const { user } = homeAnswering(threeReceived);
    expect(within(card()).queryAllByRole("link")).toEqual([]);
    await user.click(switchOption("Given"));

    expect(within(card()).queryAllByRole("link")).toEqual([]);
    expect(card().textContent).not.toMatch(/XP|quest|Said why|#|Slack/i);
  });

  it("shows a date from an earlier year with its year", () => {
    const lastYear = { ...firstOf(threeReceived), at: Date.parse("2025-12-30T10:00:00") };
    homeAnswering({ kind: "recent", entries: [lastYear] });

    expect(rowAt(0).querySelector("time")).toHaveTextContent("30 Dec 2025");
  });

  it("drops an entry of a kind it doesn't know, with no placeholder", () => {
    const unknown = { kind: "kudosSent", key: "x1", at: Date.now() } as unknown as RecentKudos["entries"][number];
    homeAnswering({ kind: "recent", entries: [unknown, firstOf(threeReceived)] });

    expect(headlinesOf()).toEqual(["Ada Lindqvist thanked you"]);
  });
});

describe("WS208: its empty states", () => {
  it("says where received kudos will show, and never asks anyone to thank the member", () => {
    homeAnswering(nothingYet, nothingYet);

    expect(card()).toHaveTextContent("Kudos you receive show here.");
    expect(within(card()).queryByRole("list")).not.toBeInTheDocument();
  });

  it("says where given kudos will show, with what each one earned", async () => {
    const { user } = homeAnswering(nothingYet, nothingYet);
    await user.click(switchOption("Given"));

    expect(card()).toHaveTextContent("Kudos you give show here, with what each one earned.");
  });
});

describe("WS209: people are named as the read names them", () => {
  it.each([
    [["Ana"], "You thanked Ana"],
    [["Ana", "Ben"], "You thanked Ana and Ben"],
    [["Ana", "Ben", "Cleo"], "You thanked Ana, Ben and Cleo"],
    [["Ana", "Ben", "Cleo", "Dan"], "You thanked Ana, Ben and 2 others"],
  ])("names %j as a list", async (names, headline) => {
    const { user } = homeAnswering(nothingYet, givenTo(names));
    await user.click(switchOption("Given"));

    expect(headlinesOf()).toEqual([headline]);
  });
});

describe("WS201: the card shows only while the read answers it", () => {
  it.each([
    ["not found", { kind: "not-found" } as const],
    ["not answered yet", undefined],
  ])("renders nothing and leaves no gap while %s", (_, answer) => {
    homeAnswering(answer);

    expect(queryCard()).not.toBeInTheDocument();
    expect(panel("What teammates see").nextElementSibling).toBe(panel("Quests this week"));
  });

  it("goes away once the read fails, even after it showed rows", async () => {
    const { user } = homeAnswering(threeReceived, { kind: "broken" });
    await user.click(switchOption("Given"));

    expect(queryCard()).not.toBeInTheDocument();
    expect(panel("What teammates see").nextElementSibling).toBe(panel("Quests this week"));
  });

  it("goes away once the read answers not found", async () => {
    const { user } = homeAnswering(threeReceived, { kind: "not-found" });
    await user.click(switchOption("Given"));

    expect(queryCard()).not.toBeInTheDocument();
  });
});
