import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aGiven, aLevelUp, aPage, aReceived, activityFixtures, anUnknownKind, teammates, words } from "./activityFixtures";
import type { ActivityRead, ActivityShown, ActivityWatch } from "./activityRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import type { ActivityFilter } from "./route";
import { shellFixtures, type Activity, type ActivityEntry, type MyActivity } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const member = shellFixtures.memberWithEveryPanelOpen;

const now = Date.parse("2026-10-14T18:00:00Z");

const minute = 60 * 1000;

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Asked = { args: Parameters<ActivityRead>[0]; resolve: (answer: MyActivity) => void; reject: (failure: Error) => void };

function pagesOnRequest() {
  const asked: Asked[] = [];
  const read: ActivityRead = (args) => new Promise((resolve, reject) => asked.push({ args, resolve, reject }));
  const askedAt = (index: number) => {
    const request = asked[index];
    if (request === undefined) throw new Error(`No read ${index} was asked; ${asked.length} were.`);
    return request;
  };
  return {
    asked,
    read,
    answer: (index: number, answer: MyActivity) => act(async () => askedAt(index).resolve(answer)),
    fail: (index: number) => act(async () => askedAt(index).reject(new Error("socket closed"))),
  };
}

function aWatch(initial: ActivityShown | undefined = aPage([], null)) {
  const state = { answer: initial, asked: [] as (ActivityFilter | undefined)[] };
  const watch: ActivityWatch = (filter) => {
    state.asked.push(filter);
    return filter === undefined ? undefined : state.answer;
  };
  return { state, watch };
}

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function openActivity({ path = "/activity", watch = aWatch().watch, read = pagesOnRequest().read }: { path?: string; watch?: ActivityWatch; read?: ActivityRead } = {}) {
  visit(path);
  return renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), { watch, read });
}

async function openedWith(entries: ActivityEntry[], { cursor = null, timeZone = "Europe/Berlin" }: { cursor?: string | null; timeZone?: string | null } = {}) {
  const pages = pagesOnRequest();
  const view = openActivity({ read: pages.read, watch: aWatch(aPage(entries, cursor, timeZone)).watch });
  await pages.answer(0, aPage(entries, cursor, timeZone));
  return { ...view, pages };
}

function main() {
  return screen.getByRole("main");
}

function timelineList() {
  return within(main()).getByRole("list", { name: "Your activity" });
}

function articles() {
  return within(main()).queryAllByRole("article");
}

function article(name: string | RegExp) {
  return within(main()).getByRole("article", { name });
}

function liveRegion() {
  return within(main()).getByTestId("activity-announcement");
}

function filterOption(name: "All" | "Received" | "Given") {
  return within(within(main()).getByRole("group", { name: "Show" })).getByRole("button", { name });
}

function loadMore() {
  return within(main()).getByRole("button", { name: /Load more|Loading…|Try again/ });
}

function stubIntersections() {
  const observers: { callback: IntersectionObserverCallback; targets: Element[]; options?: IntersectionObserverInit }[] = [];
  class FakeObserver {
    private readonly record: (typeof observers)[number];
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.record = { callback, targets: [], options };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      this.record.targets = [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return {
    observers,
    endComesNear: () =>
      act(() => {
        for (const { callback, targets } of observers) {
          for (const target of targets) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      }),
  };
}

describe("WS203: the Activity tab is the page /activity", () => {
  it("shows its label, its RoundHog title and its line, in the browser tab HedgeHug · Activity", async () => {
    await openedWith([aReceived("r1", now - minute)]);
    expect(within(main()).getByRole("heading", { level: 1, name: "Your kudos story" })).toBeInTheDocument();
    expect(main()).toHaveTextContent("Kudos you received and gave, and the levels you reached. Only you see this page.");
    expect(document.title).toBe("HedgeHug · Activity");
  });

  it("reads the filter from the address, and an unknown filter as all with no query", async () => {
    const pages = pagesOnRequest();
    openActivity({ path: "/activity?filter=given", read: pages.read });
    expect(filterOption("Given")).toHaveAttribute("aria-pressed", "true");
    expect(pages.asked[0]?.args).toEqual({ filter: "given", cursor: null });
    act(() => undefined);
    visit("/activity?filter=nonsense");
    const again = pagesOnRequest();
    openActivity({ path: "/activity?filter=nonsense", read: again.read });
    expect(window.location.pathname + window.location.search).toBe("/activity");
  });

  it("shows the not-found page while getActivity answers not-found", () => {
    openActivity({ watch: aWatch({ kind: "not-found" }).watch });
    expect(within(main()).getByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });

  it("asks the live watch for the newest page of the address's filter", () => {
    const { state, watch } = aWatch();
    openActivity({ path: "/activity?filter=received", watch });
    expect(state.asked).toContain("received");
  });
});

describe("WS204 WS302: Character and Activity tabs on the member's page", () => {
  function yourPage() {
    return within(main()).getByRole("navigation", { name: "Your page" });
  }

  it("marks Activity as the current tab on /activity, while the screen nav keeps Profile current", async () => {
    await openedWith([]);
    expect(within(yourPage()).getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
    expect(within(yourPage()).getByRole("link", { name: "Character" })).toHaveAttribute("href", "/");
    expect(within(screen.getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the tabs on the home while getRecentKudos answers, with Character current", () => {
    visit("/");
    renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }));
    expect(within(yourPage()).getByRole("link", { name: "Character" })).toHaveAttribute("aria-current", "page");
    expect(within(yourPage()).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
  });

  it("shows no tabs on the home while getRecentKudos answers not-found", () => {
    visit("/");
    renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week));
    expect(within(main()).queryByRole("navigation", { name: "Your page" })).not.toBeInTheDocument();
  });

  it("moves to /activity in place and focuses its title", async () => {
    visit("/");
    const pages = pagesOnRequest();
    const { user } = renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), { watch: aWatch().watch, read: pages.read });
    await user.click(within(yourPage()).getByRole("link", { name: "Activity" }));
    expect(window.location.pathname).toBe("/activity");
    expect(within(main()).getByRole("heading", { level: 1, name: "Your kudos story" })).toHaveFocus();
  });
});

describe("WS207: See all activity on the Recent kudos card follows its switch", () => {
  it("links to the received side, then to the given side", async () => {
    visit("/");
    const { user } = renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }));
    const card = within(main()).getByRole("region", { name: "Recent kudos" });
    expect(within(card).getByRole("link", { name: "See all activity" })).toHaveAttribute("href", "/activity?filter=received");
    await user.click(within(card).getByRole("radio", { name: "Given" }));
    expect(within(card).getByRole("link", { name: "See all activity" })).toHaveAttribute("href", "/activity?filter=given");
  });

  it("still shows on an empty card", () => {
    visit("/");
    renderApp(member, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.nothingYet, given: recentKudosFixtures.nothingYet }));
    expect(within(within(main()).getByRole("region", { name: "Recent kudos" })).getByRole("link", { name: "See all activity" })).toBeInTheDocument();
  });
});

describe("WS212: the Show filter is the address's filter query", () => {
  it("replaces the address, reads the newest page again, keeps focus on the filter and says what it shows", async () => {
    const pages = pagesOnRequest();
    const { user } = openActivity({ read: pages.read });
    await pages.answer(0, aPage([aReceived("r1", now - minute), aGiven("g1", now - 2 * minute)], "c1"));
    const historyLength = window.history.length;
    await user.click(filterOption("Given"));
    expect(window.location.search).toBe("?filter=given");
    expect(window.history.length).toBe(historyLength);
    expect(filterOption("Given")).toHaveFocus();
    expect(pages.asked.at(-1)?.args).toEqual({ filter: "given", cursor: null });
    expect(liveRegion()).toHaveTextContent("Showing kudos you gave.");
    expect(articles()).toHaveLength(0);
    await user.click(filterOption("All"));
    expect(window.location.search).toBe("");
    expect(liveRegion()).toHaveTextContent("Showing all activity.");
  });

  it("drops a page answered for the filter the member left", async () => {
    const pages = pagesOnRequest();
    const { user } = openActivity({ read: pages.read });
    await user.click(filterOption("Received"));
    await pages.answer(0, aPage([aGiven("old-filter", now - minute)], null));
    expect(articles()).toHaveLength(0);
    await pages.answer(1, aPage([aReceived("new-filter", now - minute)], null));
    expect(articles()).toHaveLength(1);
    expect(article("Ada Lindqvist thanked you")).toBeInTheDocument();
  });
});

describe("WS213: the three kinds of entry", () => {
  it("shows a kudos received quietly: the giver, the words, its tags and Open in Slack", async () => {
    await openedWith([
      aReceived("r1", now - minute, { giver: teammates.bo, saidWhy: true, channel: { visibility: "private" }, permalink: "https://example.slack.com/archives/G1/p1", message: words("Thanks for the review ", { kind: "link", url: "https://example.com/pr", label: "on the PR" }) }),
    ]);
    const entry = article("Bo Okafor thanked you");
    expect(entry).toHaveTextContent("Thanks for the review on the PR");
    expect(within(entry).getByRole("link", { name: /^on the PR/ })).toHaveAttribute("href", "https://example.com/pr");
    expect(within(entry).getByText("Private channel")).toBeInTheDocument();
    expect(within(entry).getByText("Said why")).toBeInTheDocument();
    const slack = within(entry).getByRole("link", { name: "Open in Slack: the kudos from Bo Okafor (opens in a new tab)" });
    expect(slack).toHaveAttribute("href", "https://example.slack.com/archives/G1/p1");
    expect(slack).toHaveAttribute("target", "_blank");
    expect(slack).toHaveAttribute("rel", "noreferrer");
    expect(entry).not.toHaveTextContent("XP");
  });

  it("shows no tags for a public kudos that didn't say why, and no Slack link while permalink is null", async () => {
    await openedWith([aReceived("r1", now - minute)]);
    const entry = article("Ada Lindqvist thanked you");
    expect(within(entry).queryByText("Private channel")).not.toBeInTheDocument();
    expect(within(entry).queryByText("Said why")).not.toBeInTheDocument();
    expect(within(entry).queryByRole("link", { name: /Open in Slack/ })).not.toBeInTheDocument();
  });

  it("shows a kudos given with its recipients, the kudos each, and what it earned", async () => {
    await openedWith([
      aGiven("g1", now - minute, {
        recipients: [teammates.cleo, teammates.dev],
        kudos: 3,
        permalink: "https://example.slack.com/archives/C1/p2",
        earned: {
          xp: 30,
          questsDone: [
            { kind: "weekly", goal: "Thank two teammates", xp: 40 },
            { kind: "journey", goal: "Thank someone in a new channel", xp: 50 },
          ],
          bonuses: [
            { perk: { id: "spark", name: "Spark" }, why: "Your first kudos today", xp: 5 },
            { perk: { id: "circle", name: "Circle" }, why: "A teammate you hadn't thanked yet", xp: 10 },
          ],
        },
      }),
    ]);
    const entry = article("You thanked Cleo Marchetti and Dev Rao · 3 kudos each");
    const earned = within(entry).getByRole("list", { name: "Earned" });
    expect(within(earned).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "+30 XP",
      "Spark bonus (+5 XP) · Your first kudos today",
      "Circle bonus (+10 XP) · A teammate you hadn't thanked yet",
      "Finished Thank two teammates · +40 XP",
      "Finished Journey step: Thank someone in a new channel · +50 XP",
    ]);
    expect(within(entry).getByRole("link", { name: "Open in Slack: your kudos to Cleo Marchetti and Dev Rao (opens in a new tab)" })).toBeInTheDocument();
  });

  it("names up to three recipients and counts the rest, without the count for one kudos each", async () => {
    await openedWith([aGiven("g1", now - minute, { recipients: [teammates.ada, teammates.bo, teammates.cleo, teammates.dev, teammates.eli] })]);
    expect(article("You thanked Ada Lindqvist, Bo Okafor and 3 others")).toBeInTheDocument();
    expect(within(article(/You thanked/)).getAllByTestId("person-face")).toHaveLength(3);
  });

  it("shows only the parts of Earned that are there, and no Earned line while earned is null", async () => {
    await openedWith([aGiven("xp-hidden", now - minute, { recipients: [teammates.bo], earned: { xp: null, questsDone: [{ kind: "weekly", goal: "Thank two teammates", xp: 40 }], bonuses: [] } }), aGiven("nothing", now - 2 * minute, { recipients: [teammates.cleo], earned: null })]);
    expect(within(within(article("You thanked Bo Okafor")).getByRole("list", { name: "Earned" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Finished Thank two teammates · +40 XP"]);
    expect(within(article("You thanked Cleo Marchetti")).queryByRole("list", { name: "Earned" })).not.toBeInTheDocument();
  });

  it("marks a level reached on the rule, with the level number", async () => {
    await openedWith([aLevelUp(7, now - minute)]);
    const mark = article("You reached level 7");
    expect(within(mark).getByText("7")).toHaveClass("hud-display");
  });

  it("marks deleted, removed and uncaptured words, and edited ones", async () => {
    await openedWith([
      aReceived("deleted", now - minute, { message: { kind: "unavailable", reason: "deleted" } }),
      aReceived("removed", now - 2 * minute, { giver: teammates.bo, message: { kind: "unavailable", reason: "removed" } }),
      aReceived("old", now - 3 * minute, { giver: teammates.former, message: { kind: "unavailable", reason: "not-captured" } }),
      aGiven("edited", now - 4 * minute, { message: { ...words("Typo fixed"), edited: true } }),
    ]);
    expect(article("Ada Lindqvist thanked you")).toHaveTextContent("This message was deleted in Slack.");
    expect(article("Bo Okafor thanked you")).toHaveTextContent("The words of this message were removed.");
    expect(article("A teammate thanked you")).toHaveTextContent("The words of this kudos are from before HedgeHug kept them.");
    expect(article("You thanked Bo Okafor")).toHaveTextContent("Typo fixedEdited");
  });

  it("skips an entry of a kind it doesn't know", async () => {
    await openedWith([anUnknownKind(), aReceived("r1", now - minute)]);
    expect(articles()).toHaveLength(1);
  });

  it("never calls a kudos thoughtful", async () => {
    await openedWith(activityFixtures.story.entries);
    expect(main().textContent?.toLowerCase()).not.toContain("thoughtful");
  });
});

describe("WS213: day headings and times in the answer's time zone", () => {
  it("heads each day in the member's zone across a midnight, with the year once it isn't this year", async () => {
    await openedWith(
      [
        aReceived("after-midnight", Date.parse("2026-10-14T12:00:00Z")),
        aReceived("before-midnight", Date.parse("2026-10-14T10:30:00Z"), { giver: teammates.bo }),
        aReceived("monday", Date.parse("2026-10-12T08:00:00Z"), { giver: teammates.cleo }),
        aReceived("last-year", Date.parse("2025-03-01T08:00:00Z"), { giver: teammates.dev }),
      ],
      { timeZone: "Pacific/Auckland" },
    );
    expect(within(timelineList()).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Today", "Yesterday", "Monday, 12 Oct", "Saturday, 1 Mar 2025"]);
    const time = within(article("Ada Lindqvist thanked you")).getByText("01:00");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-14T12:00:00.000Z");
    expect(within(article("Bo Okafor thanked you")).getByText("23:30")).toBeInTheDocument();
  });
});

describe("WS216: loading more", () => {
  it("appends the next page when the member presses Load more, says so, and moves focus to the first new entry", async () => {
    const { user, pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    await user.click(loadMore());
    expect(pages.asked[1]?.args).toEqual({ filter: "all", cursor: "c1" });
    expect(loadMore()).toHaveTextContent("Loading…");
    expect(loadMore()).toHaveAttribute("aria-disabled", "true");
    expect(loadMore()).toHaveFocus();
    await pages.answer(1, aPage([aGiven("g1", now - 2 * minute), aLevelUp(3, now - 3 * minute)], "c2"));
    expect(articles()).toHaveLength(3);
    expect(article("You thanked Bo Okafor")).toHaveFocus();
    expect(liveRegion()).toHaveTextContent("Loaded 2 more.");
  });

  it("asks for nothing while a page is loading", async () => {
    const { user, pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    await user.click(loadMore());
    await user.click(loadMore());
    expect(pages.asked).toHaveLength(2);
  });

  it("keeps the member's focus when they tabbed away while the page loaded", async () => {
    const { user, pages } = await openedWith([aReceived("r1", now - minute, { permalink: "https://example.slack.com/archives/C1/p1" })], { cursor: "c1" });
    await user.click(loadMore());
    const slack = within(main()).getByRole("link", { name: /Open in Slack/ });
    act(() => slack.focus());
    await pages.answer(1, aPage([aGiven("g1", now - 2 * minute)], "c2"));
    expect(slack).toHaveFocus();
  });

  it("reads the next page once the end comes within a screen, and keeps focus where it is", async () => {
    const intersections = stubIntersections();
    const { pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    expect(intersections.observers.at(-1)?.options?.rootMargin).toBe(`${window.innerHeight}px 0px`);
    const title = within(main()).getByRole("heading", { level: 1 });
    act(() => title.focus());
    await intersections.endComesNear();
    expect(pages.asked[1]?.args).toEqual({ filter: "all", cursor: "c1" });
    await pages.answer(1, aPage([aGiven("g1", now - 2 * minute)], "c2"));
    expect(title).toHaveFocus();
  });

  it("keeps reading while the end stays near, through a page of only unknown kinds", async () => {
    const intersections = stubIntersections();
    const { pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    await intersections.endComesNear();
    await pages.answer(1, aPage([anUnknownKind()], "c2"));
    await intersections.endComesNear();
    expect(pages.asked[2]?.args).toEqual({ filter: "all", cursor: "c2" });
  });

  it("offers Try again when a page fails, and scrolling doesn't retry by itself", async () => {
    const intersections = stubIntersections();
    const { user, pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    await user.click(loadMore());
    await pages.fail(1);
    expect(loadMore()).toHaveTextContent("Try again");
    expect(loadMore()).toHaveFocus();
    expect(liveRegion()).toHaveTextContent("Couldn't load more. Try again.");
    await intersections.endComesNear();
    expect(pages.asked).toHaveLength(2);
    await user.click(loadMore());
    expect(pages.asked[2]?.args).toEqual({ filter: "all", cursor: "c1" });
  });

  it("replaces the button with the closing line at the end, and moves the button's focus there", async () => {
    const { user, pages } = await openedWith([aReceived("r1", now - minute)], { cursor: "c1" });
    await user.click(loadMore());
    await pages.answer(1, aPage([], null));
    expect(within(main()).queryByRole("button", { name: /Load more/ })).not.toBeInTheDocument();
    expect(within(main()).getByText("That's the start of your activity.")).toHaveFocus();
  });

  it("shows the closing line and no button when the first page is the whole story", async () => {
    await openedWith([aReceived("r1", now - minute)]);
    expect(within(main()).queryByRole("button", { name: /Load more/ })).not.toBeInTheDocument();
    expect(within(main()).getByText("That's the start of your activity.")).toHaveAttribute("tabindex", "-1");
  });
});

describe("WS217: the first page, its failure and empty timelines", () => {
  it("shows the header, tabs and filter and says nothing while the first page loads", () => {
    openActivity();
    expect(within(main()).getByRole("heading", { level: 1, name: "Your kudos story" })).toBeInTheDocument();
    expect(within(main()).getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(articles()).toHaveLength(0);
    expect(within(main()).queryByRole("button", { name: /Load more|Try again/ })).not.toBeInTheDocument();
  });

  it("says it couldn't load and reads the first page again on Try again, keeping focus", async () => {
    const pages = pagesOnRequest();
    const { user } = openActivity({ read: pages.read });
    await pages.fail(0);
    expect(main()).toHaveTextContent("Couldn't load your activity.");
    expect(liveRegion()).toHaveTextContent("Couldn't load your activity.");
    await user.click(within(main()).getByRole("button", { name: "Try again" }));
    expect(pages.asked[1]?.args).toEqual({ filter: "all", cursor: null });
    await pages.answer(1, aPage([aReceived("r1", now - minute)], null));
    expect(articles()).toHaveLength(1);
  });

  it("treats a first page answered as not an activity as a failure", async () => {
    const pages = pagesOnRequest();
    openActivity({ read: pages.read });
    await pages.answer(0, { kind: "not-found" });
    expect(main()).toHaveTextContent("Couldn't load your activity.");
  });

  for (const [filter, sentence] of [
    ["all", "Your activity shows here once you thank someone or reach a level."],
    ["received", "Kudos you receive show here."],
    ["given", "Kudos you give show here, with what each one earned."],
  ] as const) {
    it(`says, with nothing to show on ${filter}: ${sentence}`, async () => {
      const pages = pagesOnRequest();
      openActivity({ path: `/activity?filter=${filter}`, read: pages.read });
      await pages.answer(0, aPage([], null));
      expect(main()).toHaveTextContent(sentence);
      expect(main()).not.toHaveTextContent("That's the start of your activity.");
    });
  }

  it("shows what the watch gains at once while the timeline is empty", async () => {
    const pages = pagesOnRequest();
    const { state, watch } = aWatch(aPage([], null));
    const { showVisitor } = openActivity({ read: pages.read, watch });
    await pages.answer(0, aPage([], null));
    state.answer = aPage([aReceived("arrived", now - minute)], null);
    showVisitor(member);
    expect(articles()).toHaveLength(1);
    expect(within(main()).queryByRole("button", { name: "Show new activity" })).not.toBeInTheDocument();
  });
});

describe("WS214: Show new activity", () => {
  const shown = [aReceived("r1", now - 10 * minute), aGiven("g1", now - 20 * minute)];

  async function openedWatching(watched: Activity) {
    const pages = pagesOnRequest();
    const watcher = aWatch(watched);
    const view = openActivity({ read: pages.read, watch: watcher.watch });
    return { ...view, pages, watcher };
  }

  it("never shows before the first page lands, then raises a new entry and says so once", async () => {
    const { pages, showVisitor } = await openedWatching(aPage([aReceived("new", now - minute), ...shown], null));
    expect(within(main()).queryByRole("button", { name: "Show new activity" })).not.toBeInTheDocument();
    await pages.answer(0, aPage(shown, null));
    expect(within(main()).getByRole("button", { name: "Show new activity" })).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("New activity.");
    expect(articles()).toHaveLength(2);
    showVisitor(member);
    expect(liveRegion()).toHaveTextContent("New activity.");
  });

  it("raises a shown entry whose words changed, and leaves the shown copy alone", async () => {
    const { pages } = await openedWatching(aPage([{ ...shown[0]!, message: { kind: "unavailable", reason: "deleted" } } as ActivityEntry, shown[1]!], null));
    await pages.answer(0, aPage(shown, null));
    expect(within(main()).getByRole("button", { name: "Show new activity" })).toBeInTheDocument();
    expect(article("Ada Lindqvist thanked you")).not.toHaveTextContent("deleted");
  });

  it("raises a new entry inside the newest instant", async () => {
    const { pages } = await openedWatching(aPage([shown[0]!, aReceived("same-instant", shown[0]!.at, { giver: teammates.cleo }), shown[1]!], null));
    await pages.answer(0, aPage(shown, null));
    expect(within(main()).getByRole("button", { name: "Show new activity" })).toBeInTheDocument();
  });

  it("starts again from the newest page and moves focus to its first entry", async () => {
    const { user, pages } = await openedWatching(aPage([aReceived("new", now - minute, { giver: teammates.eli }), ...shown], null));
    await pages.answer(0, aPage(shown, null));
    await user.click(within(main()).getByRole("button", { name: "Show new activity" }));
    expect(pages.asked[1]?.args).toEqual({ filter: "all", cursor: null });
    await pages.answer(1, aPage([aReceived("new", now - minute, { giver: teammates.eli }), ...shown], null));
    expect(article("Eli Brandt thanked you")).toHaveFocus();
    expect(within(main()).queryByRole("button", { name: "Show new activity" })).not.toBeInTheDocument();
  });

  it("keeps focus on the page title while the newest page loads, and there when it fails", async () => {
    const { user, pages } = await openedWatching(aPage([aReceived("new", now - minute, { giver: teammates.eli }), ...shown], null));
    await pages.answer(0, aPage(shown, null));
    await user.click(within(main()).getByRole("button", { name: "Show new activity" }));
    const title = within(main()).getByRole("heading", { level: 1 });
    expect(title).toHaveFocus();
    await pages.fail(1);
    expect(title).toHaveFocus();
  });

  it("forgets the focus it owed a failed Show new activity once the member changes the filter", async () => {
    const { user, pages } = await openedWatching(aPage([aReceived("new", now - minute, { giver: teammates.eli }), ...shown], null));
    await pages.answer(0, aPage(shown, null));
    await user.click(within(main()).getByRole("button", { name: "Show new activity" }));
    await pages.fail(1);
    await user.click(filterOption("Given"));
    await pages.answer(2, aPage([aGiven("g9", now - minute)], null));
    expect(filterOption("Given")).toHaveFocus();
  });

  it("raises nothing while the watch holds what is shown", async () => {
    const { pages } = await openedWatching(aPage(shown, null));
    await pages.answer(0, aPage(shown, null));
    expect(within(main()).queryByRole("button", { name: "Show new activity" })).not.toBeInTheDocument();
  });
});

describe("a kudos message renders as text", () => {
  it("keeps markup in a timeline page's words as text and links only http and https", async () => {
    await openedWith([
      aReceived("markup", now - minute, {
        message: words("<script>alert(1)</script> <img src=x onerror=alert(2)> &amp; ", { kind: "link", url: "javascript:alert(3)", label: "click" }, { kind: "link", url: "data:text/html,<b>hi</b>", label: "data" }, { kind: "link", url: "https://example.com", label: "web" }),
      }),
    ]);
    const theWords = within(article("Ada Lindqvist thanked you")).getByTestId("kudos-message-words");
    expect(theWords).toHaveTextContent("<script>alert(1)</script> <img src=x onerror=alert(2)> &amp;");
    expect(theWords.querySelector("script, img")).toBeNull();
    expect([...theWords.querySelectorAll("a")].map((link) => new URL(link.href).protocol)).toEqual(["https:"]);
  });
});
