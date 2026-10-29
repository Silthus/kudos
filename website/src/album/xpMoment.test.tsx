import { act, fireEvent, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../../convex/activity/entries";
import type { Id } from "../../../convex/_generated/dataModel";
import { levelOf, xpToReach } from "../../../convex/progression/levels";
import type { BoardItem } from "../../../convex/website/album";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { contrastUnderScrim } from "../test/themeContrast";
import { albumFixtures, fixedAlbum, fixedPeople, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead, XpMomentRead, XpMomentShown } from "./answer";

const minute = 60_000;

const lastVisit = Date.parse("2026-10-19T09:12:00Z");

const words = (text: string): Message => ({ kind: "text", segments: [{ kind: "text", text }], edited: false });

const initials = (name: string) => ({ name, face: { kind: "initials" as const, initials: name.split(" ").map((word) => word[0]).join("") } });

const busyReturn: XpMoment = {
  kind: "moment",
  since: lastVisit,
  until: lastVisit + 50 * minute,
  excerpts: [
    { entry: { kind: "kudosReceived", key: "k1", at: lastVisit + 10 * minute, giver: initials("Ines Okafor"), channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("thank you for pairing on the flaky deploy") }, xp: 10 },
    { entry: { kind: "hugReceived", key: "h1", at: lastVisit + 20 * minute, givers: [initials("Fen Marlowe")], emoji: "hugging_face", hugs: 3, xp: 3, on: "C1/1.1", permalink: null, kudos: null }, xp: 3 },
    { entry: { kind: "kudosGiven", key: "k2", at: lastVisit + 30 * minute, recipients: [initials("Wren Alder")], kudos: 1, channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("for the clearest onboarding doc"), earned: { xp: 15, questsDone: [], bonuses: [] } }, xp: 15 },
    { entry: { kind: "kudosReceived", key: "k3", at: lastVisit + 40 * minute, giver: initials("Bram Teller"), channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("for getting the release notes out") }, xp: 10 },
    { entry: { kind: "levelUp", at: lastVisit + 50 * minute, level: 7 }, xp: 0 },
  ],
  fold: { count: 12, xp: 140 },
  moments: 16,
  xp: 178,
  climb: { from: { level: 6, xp: 1462, startsAt: 1000, nextAt: 1500 }, to: { level: 7, xp: 1640, startsAt: 1500, nextAt: 2100 } },
  quests: [],
  progressed: [],
  waiting: 3,
  thoughtfulGivers: 4,
  timeZone: "UTC",
};

const quietReturn: XpMoment = { ...busyReturn, excerpts: [busyReturn.excerpts[0]!], fold: null, moments: 1, xp: 10, climb: { from: { level: 7, xp: 1630, startsAt: 1500, nextAt: 2100 }, to: { level: 7, xp: 1640, startsAt: 1500, nextAt: 2100 } } };

const returning: Album = { ...albumFixtures.withItems, level: busyReturn.climb.to, lastVisit };

const caughtUp: Album = { ...returning, board: { items: [], more: false } };

const desktop = { width: 1440, height: 900 };

const phone = { width: 390, height: 844 };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function aMomentAnsweredLater() {
  let answer: XpMomentShown | undefined;
  const listeners = new Set<() => void>();
  const read: XpMomentRead = (asking) => {
    const shown = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => answer,
    );
    return asking ? shown : undefined;
  };
  const answerWith = (next: XpMomentShown) => {
    answer = next;
    listeners.forEach((listener) => listener());
  };
  return { read, answerWith };
}

function anAlbumThatAnswers(first: Album) {
  let answer = first;
  const listeners = new Set<() => void>();
  const read: AlbumRead = (asking) => {
    const shown = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => answer,
    );
    return asking ? shown : undefined;
  };
  const answers = (change: (album: Album) => Album) => {
    answer = change(answer);
    listeners.forEach((listener) => listener());
  };
  return { read, answers };
}

function sizeTheWindow({ width, height }: { width: number; height: number }) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

let started = 0;

type Visit = { moment?: XpMomentShown; album?: Album; read?: AlbumRead; screenSize?: { width: number; height: number }; turnItem?: (item: string) => Promise<TurnReply> };

async function returnTo({ moment = busyReturn, album = returning, read = fixedAlbum(album), screenSize = desktop, turnItem }: Visit = {}) {
  window.history.replaceState(null, "", "/book#me");
  sizeTheWindow(screenSize);
  const later = aMomentAnsweredLater();
  const view = renderAlbum(shellFixtures.member, read, { xpMoment: later.read, people: fixedPeople(album), commands: turnItem === undefined ? {} : { turnItem } });
  await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });
  vi.useFakeTimers();
  started = Date.now();
  await act(async () => later.answerWith(moment));
  return { ...view, answerWith: later.answerWith };
}

const frameMs = 16;

async function at(seconds: number) {
  const due = started + Math.round(seconds * 1000);
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(Math.min(frameMs, due - Date.now())));
}

async function inAnother(seconds: number) {
  await at((Date.now() - started) / 1000 + seconds);
}

async function collectAt(seconds: number) {
  await at(seconds);
  started = Date.now();
  await act(async () => fireEvent.click(theOrb()));
}

function theCanvas() {
  return screen.queryByRole("dialog", { name: "Since your last visit" });
}

function theCards() {
  return [...(theCanvas()?.querySelectorAll<HTMLElement>(".xpm-card[data-shown]") ?? [])];
}

function theColumns() {
  return [...theCanvas()!.querySelectorAll<HTMLElement>(".xpm-column")].map((column) => [...column.querySelectorAll<HTMLElement>(".xpm-card")].map((card) => within(card).queryByRole("article")?.getAttribute("aria-label") ?? card.textContent));
}

function theOrb() {
  return within(theCanvas()!).getByRole("button", { name: /^Collect your XP/ });
}

function theOrbSays() {
  return theOrb().querySelector(".xpm-orb-xp")!.textContent;
}

function theTopBar() {
  return within(screen.getAllByRole("banner", { hidden: true })[0]!);
}

function xpWords() {
  return theTopBar().getByText(/XP to level/, { selector: ".al-xp-words" }).textContent;
}

function theLevelPill() {
  return theTopBar().getByText(/^Level \d+$/, { selector: ".al-level" });
}

function earnedInTheTopBar() {
  const label = theTopBar().getByRole("button", { name: /^Your emojis, \d+ earned/, hidden: true }).getAttribute("aria-label")!;
  return Number(/(\d+) earned/.exec(label)![1]);
}

function earnedOf(emojis: Album["emojis"]) {
  return emojis.filter(({ earned }) => earned).length;
}

function theEmojiOnItsWay() {
  return document.querySelector<HTMLElement>("body > .al-emoji-copy");
}

function theItemBoard() {
  return screen.queryByRole("dialog", { name: "Your items" });
}

const canvasArrival = 0.6;

const arrivedAndRead = canvasArrival + 6 * 0.17 + 0.55;

describe("LP29 LP30: the XP moment plays on the dim canvas out of the mystery orb", { timeout: 30_000 }, () => {
  it("settles for 600 ms, then dims the page under the top bar with the XP bar lit, and the excerpts and the fold fly out of the orb 170 ms apart", async () => {
    await returnTo();

    await at(0.55);
    expect(theCanvas()).toBeNull();
    await at(canvasArrival);
    expect(theCanvas()).toBeInTheDocument();
    expect(document.querySelector(".al-shell")).toHaveAttribute("data-xp-moment");
    expect(theCards()).toHaveLength(1);
    await at(canvasArrival + 0.17);
    expect(theCards()).toHaveLength(2);
    await at(canvasArrival + 4 * 0.17);
    expect(theCards()).toHaveLength(5);
    await at(canvasArrival + 5 * 0.17);
    expect(theCards()).toHaveLength(6);
    expect(theOrbSays()).toBe("?");
    expect(theOrb()).toHaveTextContent(/^\?\s*XP\s*Tap to collect$/);
    expect(xpWords(), "the bar holds the standing before the moment's XP").toBe("38 XP to level 7");
  });

  it("shows each kind as a Slack message under its own label and XP chip, senders as initials on a colour, HedgeHug's own message with the sitting hedgehog, and the fold line with its XP", async () => {
    await returnTo();
    await at(arrivedAndRead);

    const [fromInes, hugs, given, fromBram, level] = theCards().map((card) => within(card));
    expect(fromInes!.getByRole("article", { name: "Kudos for you" })).toHaveTextContent("Ines Okafor");
    expect(fromInes!.getByText("IO", { selector: ".xpm-slack-avatar" })).toHaveAttribute("data-tone");
    expect(fromInes!.getByText("thank you for pairing on the flaky deploy")).toBeInTheDocument();
    expect(fromInes!.getByText("+10 XP")).toBeInTheDocument();
    expect(hugs!.getByRole("article", { name: "3 hugs on your message" })).toHaveTextContent("+3 XP");
    expect(given!.getByRole("article", { name: "Kudos you gave" })).toHaveTextContent("Sam Example");
    expect(given!.getByText("+15 XP")).toBeInTheDocument();
    expect(fromBram!.getByRole("article", { name: "Kudos for you" })).toHaveTextContent("Bram Teller");
    expect(level!.getByRole("article", { name: "Level up" })).toHaveTextContent("You reached level 7!");
    expect(level!.getByRole("article", { name: "Level up" }).querySelector(".xpm-slack-avatar-app img")).not.toBeNull();
    expect(level!.queryByText(/XP$/)).toBeNull();
    expect(theCards()[5]).toHaveTextContent("+12 more kudos and hugs+140 XP");
    expect(theCards()[0]).toHaveTextContent("Mon 09:22");
  });

  it("shows a sender's Slack picture in place of their initials, and every message in full with its Slack marks", async () => {
    const thanks = { kind: "text" as const, segments: [{ kind: "person" as const, name: "Sam Example", person: "sam-example" }, { kind: "text" as const, text: ` ${"thank you for pairing on the flaky deploy, ".repeat(8)}the end` }], edited: true };
    const [fromInes] = busyReturn.excerpts as [XpMoment["excerpts"][number]];
    const pictured = { ...fromInes, entry: { ...fromInes.entry, giver: { name: "Ines Okafor", face: { kind: "slack" as const, image: "https://avatars.example/ines.png", initials: "IO" } }, message: thanks } } as XpMoment["excerpts"][number];
    await returnTo({ moment: { ...busyReturn, excerpts: [pictured, ...busyReturn.excerpts.slice(1)] } });
    await at(arrivedAndRead);

    const fromInesNow = within(theCards()[0]!);
    expect(fromInesNow.queryByText("IO")).toBeNull();
    expect(theCards()[0]!.querySelector(".xpm-slack-avatar img")).toHaveAttribute("src", "https://avatars.example/ines.png");
    expect(fromInesNow.getByText("@Sam Example")).toHaveAttribute("data-mention", "loud");
    expect(fromInesNow.getByTestId("kudos-message-words")).toHaveTextContent(/the end \(edited\)$/);
    expect(fromInesNow.queryAllByRole("link")).toEqual([]);
  });

  it("on a desktop stacks the excerpts in two columns either side of the orb, in the order they happened", async () => {
    await returnTo();
    await at(arrivedAndRead);

    expect(theColumns()).toEqual([
      ["Kudos for you", "3 hugs on your message", "Kudos you gave"],
      ["Kudos for you", "Level up", "+12 more kudos and hugs+140 XP"],
    ]);
  });

  it("flies every excerpt out from the orb, the first one too", async () => {
    await returnTo();
    await at(arrivedAndRead);

    expect(theCards().map((card) => card.style.getPropertyValue("--from-x"))).toEqual(["0px", "0px", "0px", "0px", "0px", "0px"]);
  });

  it("on a phone stacks the excerpts in one column over the orb", async () => {
    await returnTo({ screenSize: phone });
    await at(arrivedAndRead);

    expect(theCanvas()).toHaveAttribute("data-narrow");
    expect(theColumns()).toEqual([["Kudos for you", "3 hugs on your message", "Kudos you gave", "Kudos for you", "Level up", "+12 more kudos and hugs+140 XP"]]);
  });
});

const barelyThere = 1.5;

function theTopBarEndsAt(bottom: number) {
  const measured = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.matches(".al-top") ? new DOMRect(0, 0, window.innerWidth, bottom) : measured.call(this);
  });
}

function aWatchedTopBar() {
  const watchers = new Map<Element, () => void>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly changed: () => void) {}
      observe(element: Element) {
        watchers.set(element, this.changed);
      }
      disconnect() {}
    },
  );
  return { changesSize: () => act(async () => watchers.get(document.querySelector(".al-top")!)?.()) };
}

describe("LP29 LP33: the canvas covers the page in both themes and on a phone", { timeout: 30_000 }, () => {
  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode} the page's words show through the canvas at under ${barelyThere}:1, on the page and on its cards`, () => {
      const throughTheCanvas = ["background", "card"].map((surface) => ({ surface, ratio: contrastUnderScrim(mode, "foreground", surface, { scrim: "xpm-canvas-scrim" }) }));

      expect(throughTheCanvas.filter(({ ratio }) => ratio >= barelyThere)).toEqual([]);
    });
  }

  it("on a phone, where the top bar wraps the XP row under the brand, the canvas starts under the whole bar", async () => {
    theTopBarEndsAt(80);
    await returnTo({ screenSize: phone });
    await at(canvasArrival);

    expect(theCanvas()!.style.getPropertyValue("--xpm-top")).toBe("80px");
  });

  it("follows the top bar when it wraps after the window narrows", async () => {
    const theBar = aWatchedTopBar();
    theTopBarEndsAt(56);
    await returnTo();
    await at(canvasArrival);

    theTopBarEndsAt(80);
    await theBar.changesSize();

    expect(theCanvas()!.style.getPropertyValue("--xpm-top")).toBe("80px");
  });
});

describe("LP31 LP32: collecting streams the XP into the bar and the canvas becomes the item board", { timeout: 30_000 }, () => {
  it("waits for the member with no countdown: nothing collects on its own, nor on a click beside the orb", async () => {
    await returnTo();
    await at(arrivedAndRead);

    expect(theOrb().querySelector("svg")).toBeNull();
    await act(async () => fireEvent.click(theCards()[0]!));
    await act(async () => fireEvent.click(theCanvas()!));
    await at(arrivedAndRead + 120);
    expect(theOrbSays()).toBe("?");
    expect(theCards()).toHaveLength(6);
    expect(theCards().some((card) => card.hasAttribute("data-dissolving"))).toBe(false);
  });

  it("a click on the orb collects: the excerpts dissolve 140 ms apart over 720 ms while the orb counts up from +0 to the total", async () => {
    await returnTo();
    await collectAt(arrivedAndRead);

    expect(theOrbSays()).toBe("+0");
    expect(theOrb()).not.toHaveTextContent("Tap to collect");
    expect(theCards().filter((card) => card.hasAttribute("data-dissolving"))).toHaveLength(1);
    await at(0.15);
    expect(theCards().filter((card) => card.hasAttribute("data-dissolving"))).toHaveLength(2);
    await at(0.73);
    expect(theOrbSays()).toBe("+10");
    await at(0.87);
    expect(theOrbSays()).toBe("+13");
    await at(1.01);
    expect(theOrbSays()).toBe("+28");
    await at(1.15);
    expect(theOrbSays()).toBe("+38");
    await at(1.43);
    expect(theOrbSays()).toBe("+178");
    expect(theCards()).toHaveLength(0);
  });

  it("after a 550 ms beat the orb streams into the bar, which fills particle by particle and pops the level pill when it crosses a level", async () => {
    await returnTo();
    await collectAt(arrivedAndRead);

    await at(1.42 + 0.5);
    expect(xpWords()).toBe("38 XP to level 7");
    expect(theOrb()).not.toHaveAttribute("data-launch");
    await at(1.42 + 0.56);
    expect(theOrb()).toHaveAttribute("data-launch");
    await at(1.42 + 0.55 + 0.1);
    expect(theLevelPill()).toHaveTextContent("Level 6");
    expect(xpWords()).not.toBe("38 XP to level 7");
    await at(1.42 + 0.55 + 0.35);
    expect(theLevelPill()).toHaveTextContent("Level 7");
    expect(theLevelPill()).toHaveAttribute("data-popped");
    await at(1.42 + 0.55 + 0.75);
    expect(xpWords()).toBe("460 XP to level 8");
  });

  it("then reads the summary and the norm line and becomes the item board, and ends the moment where it read, instead of arriving", async () => {
    const { actions } = await returnTo();
    await collectAt(arrivedAndRead);

    await at(1.42 + 0.55 + 0.7 + 0.4);
    await act(async () => fireEvent.click(theTakeover()!));
    expect(theCanvas()).toBeNull();
    const board = within(theItemBoard()!);
    expect(board.getByText(/from 16 moments since/)).toHaveTextContent("+178 XP from 16 moments since Mon 09:12");
    expect(board.getByText("4 teammates gave thoughtful kudos this week")).toBeInTheDocument();
    expect(board.getAllByRole("button", { name: "An unidentified item. Identify it" })).toHaveLength(3);
    expect(board.getByRole("button", { name: "Later" })).toBeInTheDocument();
    expect(document.querySelector(".al-shell")).not.toHaveAttribute("data-xp-moment");
    expect(actions.endXpMoment).toHaveBeenCalledTimes(1);
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, false, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
    expect(actions.arrive).not.toHaveBeenCalled();
  });

  it("hides the norm line below three teammates", async () => {
    await returnTo({ moment: { ...busyReturn, thoughtfulGivers: 2 } });
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));

    expect(within(theItemBoard()!).getByText(/from 16 moments since/)).toBeInTheDocument();
    expect(screen.queryByText(/teammates gave thoughtful kudos/)).toBeNull();
  });

  it("with no items waiting it reads the summary on the canvas with All caught up, then leaves", async () => {
    await returnTo({ album: caughtUp, moment: { ...quietReturn, waiting: 0 } });
    await collectAt(canvasArrival + 2 * 0.17 + 0.55);

    await at(0.72 + 0.55 + 0.7 + 0.4);
    expect(within(theCanvas()!).getByText(/from 1 moment since/)).toHaveTextContent("+10 XP from 1 moment since Mon 09:12");
    expect(within(theCanvas()!).getByText("All caught up")).toBeInTheDocument();
    expect(theItemBoard()).toBeNull();
    await at(0.72 + 0.55 + 0.7 + 0.4 + 2.6);
    expect(theCanvas()).toBeNull();
  });
});

describe("LP33 LP26: skip, reduced motion, quiet visits and one arrival per visit", { timeout: 30_000 }, () => {
  it("Skip lands all the XP at once and shows the end state, ending the moment as skipped", async () => {
    const { actions } = await returnTo();
    await at(canvasArrival + 0.2);

    await act(async () => fireEvent.click(within(theCanvas()!).getByRole("button", { name: "Skip" })));

    expect(theCanvas()).toBeNull();
    expect(xpWords()).toBe("460 XP to level 8");
    expect(within(theItemBoard()!).getByText(/from 16 moments since/)).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
  });

  it("Esc lands everything at once too", async () => {
    const { actions } = await returnTo();
    await at(arrivedAndRead + 1);

    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));

    expect(theCanvas()).toBeNull();
    expect(theItemBoard()).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
  });

  it("reduced motion shows the end state at once", async () => {
    preferReducedMotion();
    const { actions } = await returnTo();

    expect(theCanvas()).toBeNull();
    expect(xpWords()).toBe("460 XP to level 8");
    expect(within(theItemBoard()!).getByText(/from 16 moments since/)).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, false, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
  });

  it("reduced motion keeps that end state when the member turns the last item: All caught up never pops over what landed", async () => {
    preferReducedMotion();
    const lastOne = { ...returning, board: { items: [returning.board!.items[0]!], more: false } };
    const live = anAlbumThatAnswers(lastOne);
    const turnItem = async (item: string) => {
      live.answers((album) => ({ ...album, board: { items: [], more: false } }));
      return fixtureTurnOf(item);
    };
    await returnTo({ album: lastOne, read: live.read, turnItem });

    await act(async () => fireEvent.click(within(theItemBoard()!).getByRole("button", { name: "An unidentified item. Identify it" })));

    for (const seconds of [0.5, 1, 2, 3]) {
      await at(seconds);
      expect(theCanvas(), `${seconds} s after the turn`).toBeNull();
      expect(document.querySelector(".al-body"), `${seconds} s after the turn`).not.toHaveAttribute("inert");
    }
  });

  it("holds the item board and the arrival while the moment is read", async () => {
    window.history.replaceState(null, "", "/book#me");
    sizeTheWindow(desktop);
    const later = aMomentAnsweredLater();
    const { actions } = renderAlbum(shellFixtures.member, fixedAlbum(returning), { xpMoment: later.read, people: fixedPeople(returning) });
    await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });

    expect(theItemBoard()).toBeNull();
    expect(actions.arrive).not.toHaveBeenCalled();
  });

  it("with nothing since the last visit nothing plays: the shell arrives from the last visit as before and the items show", async () => {
    const { actions } = await returnTo({ moment: { kind: "none", lastVisit } });
    await at(1);

    expect(theCanvas()).toBeNull();
    expect(theItemBoard()).toBeInTheDocument();
    expect(screen.queryByText(/moments since/)).toBeNull();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
    expect(actions.arrive).toHaveBeenCalledWith(lastVisit);
    expect(actions.endXpMoment).not.toHaveBeenCalled();
  });

  it("with nothing since and nothing waiting nothing plays at all", async () => {
    await returnTo({ album: caughtUp, moment: { kind: "none", lastVisit } });
    await at(3);

    expect(theCanvas()).toBeNull();
    expect(theItemBoard()).toBeNull();
  });

  it("arrives from the last visit the moment read when the album keeps none, as with hidden-items off", async () => {
    const { lastVisit: _kept, ...withoutTheLastVisit } = returning;
    const { actions } = await returnTo({ album: { ...withoutTheLastVisit, board: null }, moment: { kind: "none", lastVisit } });
    await at(1);

    expect(actions.arrive).toHaveBeenCalledWith(lastVisit);
  });

  it("with xp-moments off the shell arrives at once as before and the item board opens", async () => {
    const { actions } = await returnTo({ moment: { kind: "off" } });
    await at(0.1);

    expect(theCanvas()).toBeNull();
    expect(theItemBoard()).toBeInTheDocument();
    expect(actions.arrive).toHaveBeenCalledWith(lastVisit);
    expect(actions.endXpMoment).not.toHaveBeenCalled();
  });

  it("ends the moment once however it lands", async () => {
    const { actions } = await returnTo();
    await collectAt(arrivedAndRead);
    await at(1);
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    await at(5);

    expect(actions.endXpMoment).toHaveBeenCalledTimes(1);
  });
});

const levelItemsOf = (level: number): BoardItem[] => Array.from({ length: 3 }, (_, index) => ({ item: `level-${level}-${index + 1}` as Id<"items">, earnedAt: lastVisit + 50 * minute, reason: { kind: "levelUp", level } }));

const withLevelSevenItems: Album = { ...returning, board: { items: [...returning.board!.items, ...levelItemsOf(7)], more: false } };

function standingAt(xp: number) {
  const level = levelOf(xp);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}

const toLevelTen: XpMoment = {
  ...busyReturn,
  excerpts: busyReturn.excerpts.map((excerpt) => (excerpt.entry.kind === "levelUp" ? { ...excerpt, entry: { ...excerpt.entry, level: 10 } } : excerpt)),
  climb: { from: standingAt(xpToReach(10) - 50), to: standingAt(xpToReach(10) + 128) },
};

const levelTenEarned = returning.emojis.map((emoji) => (emoji.id === "level:10" ? { ...emoji, earned: true, earnedAt: lastVisit + 50 * minute, seen: false, progress: null } : emoji));

const levelTenEarnedInSlack = (inSlack: boolean) => levelTenEarned.map((emoji) => (emoji.id === "level:10" ? { ...emoji, inSlack } : emoji));

const kudosEmojiHowTo = { kudosEmoji: "hedgehog", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hedgehog/1.png" };

const atLevelTen: Album ={ ...returning, level: toLevelTen.climb.to, emojis: levelTenEarned, board: { items: [...returning.board!.items, ...levelItemsOf(10)], more: false } };

const collectedAndStreamed = 1.42 + 0.55 + 0.7 + 0.38;

function theTakeover() {
  return screen.queryByRole("group", { name: /^You reached level \d+$/ });
}

function theEmojiPopUp() {
  return screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ });
}

async function theLevelEmojiPlaysInThePopUpAndIsThenSeen(markEmojisSeen: (ids: string[]) => unknown) {
  expect(markEmojisSeen).not.toHaveBeenCalled();
  await inAnother(3);
  const popUp = within(theEmojiPopUp()!);
  expect(popUp.getByRole("heading", { name: ":level-10:" })).toBeInTheDocument();
  expect(markEmojisSeen).not.toHaveBeenCalled();

  await act(async () => fireEvent.click(popUp.getByRole("button", { name: "Add to my emojis" })));
  await inAnother(3);

  expect(theEmojiPopUp()).toBeNull();
  expect(markEmojisSeen).toHaveBeenCalledTimes(1);
  expect(markEmojisSeen).toHaveBeenCalledWith(["level:10"]);
}

async function crossTheLevel(visit: Visit = {}) {
  const view = await returnTo(visit);
  await collectAt(arrivedAndRead);
  await at(collectedAndStreamed + 0.02);
  return view;
}

describe("LP34: the level-up takeover in the XP moment", { timeout: 30_000 }, () => {
  it("after the bar fills across a level a gold Level N disc drops, reads You reached level N!, the level's items face down and how far the next level is, with no skill point or emblem, and stays until a click flows into the board where they wait with their tag", async () => {
    const { actions } = await returnTo({ album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(collectedAndStreamed - 0.1);
    expect(theTakeover()).toBeNull();
    await at(collectedAndStreamed + 0.02);
    const takeover = within(theTakeover()!);
    expect(theTakeover()!.querySelector(".xpm-lvl-disc")).toHaveTextContent(/^Level\s*7$/);
    expect(theTakeover()!.querySelector(".xpm-lvl-rays")).not.toBeNull();
    expect(takeover.getByTestId("confetti")).toHaveAttribute("data-size", "gold");
    expect(takeover.getByRole("heading", { name: "You reached level 7!" })).toBeInTheDocument();
    const items = takeover.getByRole("listitem", { name: "3 new items unlocked" });
    expect(items.querySelectorAll(".ib-back")).toHaveLength(3);
    expect(items).toHaveTextContent("3 new items unlockedwaiting to be identified");
    expect(takeover.getByText("Level 8 is 460 XP away")).toBeInTheDocument();
    expect(takeover.getAllByRole("listitem")).toHaveLength(1);
    expect(theTakeover()).not.toHaveTextContent(/skill point|emblem/i);
    expect(xpWords()).toBe("460 XP to level 8");
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, false, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });

    await at(collectedAndStreamed + 30);
    expect(theTakeover()).toBeInTheDocument();
    expect(theItemBoard()).toBeNull();

    await act(async () => fireEvent.click(theTakeover()!));
    expect(theTakeover()).toBeNull();
    expect(theCanvas()).toBeNull();
    const board = within(theItemBoard()!);
    expect(board.getByText(/from 16 moments since/)).toBeInTheDocument();
    const levelItems = board.getAllByRole("button", { name: "An unidentified item from level 7. Identify it" });
    expect(levelItems).toHaveLength(3);
    expect(levelItems.map((item) => within(item).getByText("Level 7"))).toHaveLength(3);
    expect(actions.endXpMoment).toHaveBeenCalledTimes(1);
  });

  it("pops the level's emoji in after the items where the level earns one and counts it as seen once, so the arrival emoji pop-up never shows it", async () => {
    const { actions } = await crossTheLevel({ moment: toLevelTen, album: atLevelTen });

    const unlocks = within(theTakeover()!).getAllByRole("listitem");
    expect(unlocks.map((unlock) => unlock.getAttribute("aria-label"))).toEqual(["3 new items unlocked", "New emoji :level-10:"]);
    expect(unlocks[1]!.querySelector("img")).toHaveAttribute("src", "/emoji/level-10.png");
    expect(within(theTakeover()!).getByText("Level 11 is 772 XP away")).toBeInTheDocument();
    expect(actions.markEmojisSeen).toHaveBeenCalledTimes(1);
    expect(actions.markEmojisSeen).toHaveBeenCalledWith(["level:10"]);

    await act(async () => fireEvent.click(theTakeover()!));
    await at(collectedAndStreamed + 3);
    expect(theItemBoard()).toBeInTheDocument();
    expect(theEmojiPopUp()).toBeNull();
    expect(actions.markEmojisSeen).toHaveBeenCalledTimes(1);
  });

  it("springs the level's emoji in, then sends it up into the emoji button, which counts it only once it lands", async () => {
    await crossTheLevel({ moment: toLevelTen, album: atLevelTen });
    const all = earnedOf(levelTenEarned);

    expect(earnedInTheTopBar(), "while it springs in").toBe(all - 1);
    expect(theEmojiOnItsWay()).toBeNull();
    await inAnother(2.6);
    expect(theEmojiOnItsWay(), "on its way up").toHaveAttribute("data-kind", "level");
    expect(earnedInTheTopBar(), "while on its way").toBe(all - 1);
    await inAnother(0.8);
    expect(theEmojiOnItsWay()).toBeNull();
    expect(earnedInTheTopBar(), "once it lands").toBe(all);
    expect(theTakeover(), "the takeover still waits for a click").toBeInTheDocument();
  });

  it("keeps the level's emoji out of the top bar's count from the return through the XP filling the bar, so the count never runs ahead of its flight", async () => {
    await returnTo({ moment: toLevelTen, album: atLevelTen });
    const all = earnedOf(levelTenEarned);
    expect(earnedInTheTopBar(), "on arrival").toBe(all - 1);

    await collectAt(arrivedAndRead);
    expect(earnedInTheTopBar(), "as the XP is collected").toBe(all - 1);
    await at(collectedAndStreamed - 0.1);
    expect(earnedInTheTopBar(), "as the bar crosses the level").toBe(all - 1);
    await at(collectedAndStreamed + 0.02);
    expect(earnedInTheTopBar(), "as the takeover drops in").toBe(all - 1);
  });

  it("counts the level's emoji at once when Continue comes before it lands", async () => {
    await crossTheLevel({ moment: toLevelTen, album: atLevelTen });

    await act(async () => fireEvent.click(within(theTakeover()!).getByRole("button", { name: "Continue" })));

    expect(earnedInTheTopBar()).toBe(earnedOf(levelTenEarned));
  });

  it("takes the emoji on its way up along with the takeover when Continue comes mid-flight", async () => {
    await crossTheLevel({ moment: toLevelTen, album: atLevelTen });
    await inAnother(2.6);
    expect(theEmojiOnItsWay(), "on its way up").not.toBeNull();

    await act(async () => fireEvent.click(within(theTakeover()!).getByRole("button", { name: "Continue" })));

    expect(theEmojiOnItsWay()).toBeNull();
    expect(earnedInTheTopBar()).toBe(earnedOf(levelTenEarned));
  });

  it("LP72: while onboarding is on, shows the level's emoji Slack has as :name: unlocked with how to use it, naming the workspace's kudos emoji", async () => {
    await crossTheLevel({ moment: toLevelTen, album: { ...atLevelTen, emojis: levelTenEarnedInSlack(true), emojiHowTo: kudosEmojiHowTo } });

    const unlocked = within(theTakeover()!).getByRole("listitem", { name: ":level-10: unlocked" });
    expect(unlocked).toHaveTextContent(":level-10: unlocked");
    const howTo = within(unlocked).getByText(/^React or thank with it\. It counts like/);
    expect(howTo).toHaveTextContent(/^React or thank with it\. It counts like \.$/);
    expect(within(howTo).getByRole("img", { name: ":hedgehog:" })).toHaveAttribute("src", kudosEmojiHowTo.kudosEmojiImage);
    expect(unlocked).not.toHaveTextContent("New emoji unlocked");
  });

  it("LP72: while onboarding is on, a level's emoji Slack lacks keeps New emoji unlocked and promises no use", async () => {
    await crossTheLevel({ moment: toLevelTen, album: { ...atLevelTen, emojis: levelTenEarnedInSlack(false), emojiHowTo: kudosEmojiHowTo } });

    const unlocked = within(theTakeover()!).getByRole("listitem", { name: "New emoji :level-10:" });
    expect(unlocked).toHaveTextContent(/^:level-10:New emoji unlocked$/);
    expect(theTakeover()).not.toHaveTextContent(/React or thank with it|counts like/);
  });

  it("LP72: while the takeover stays open, an emoji Slack stops having loses the how-to line and one Slack starts having gains it", async () => {
    const album = anAlbumThatAnswers({ ...atLevelTen, emojis: levelTenEarnedInSlack(true), emojiHowTo: kudosEmojiHowTo });
    await crossTheLevel({ moment: toLevelTen, album: atLevelTen, read: album.read });
    expect(within(theTakeover()!).getByRole("listitem", { name: ":level-10: unlocked" })).toBeInTheDocument();

    const slackHas = (inSlack: boolean, name: string) => (answered: Album) => ({ ...answered, emojis: answered.emojis.map((emoji) => (emoji.id === "level:10" ? { ...emoji, name, inSlack, seen: true } : emoji)) });
    await act(async () => album.answers(slackHas(false, "level-ten")));
    expect(within(theTakeover()!).getByRole("listitem", { name: "New emoji :level-ten:" })).toHaveTextContent(/^:level-ten:New emoji unlocked$/);

    await act(async () => album.answers(slackHas(true, "ten")));
    expect(within(theTakeover()!).getByRole("listitem", { name: ":ten: unlocked" })).toHaveTextContent(/React or thank with it/);
  });

  it("leaves out an emoji the member has already seen and the items line when none of the level's items wait, and flows into All caught up", async () => {
    const seenAlready = levelTenEarned.map((emoji) => (emoji.id === "level:10" ? { ...emoji, seen: true } : emoji));
    await crossTheLevel({ moment: { ...toLevelTen, waiting: 0 }, album: { ...atLevelTen, emojis: seenAlready, board: { items: [], more: false } } });

    expect(theTakeover()).toHaveTextContent("You reached level 10!");
    expect(within(theTakeover()!).queryAllByRole("listitem")).toHaveLength(0);
    await act(async () => fireEvent.click(theTakeover()!));
    expect(within(theCanvas()!).getByText("All caught up")).toBeInTheDocument();
  });

  it("Continue has the focus, and Esc flows into the board as a click does", async () => {
    await crossTheLevel({ album: withLevelSevenItems });

    expect(within(theTakeover()!).getByRole("button", { name: "Continue" })).toHaveFocus();
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    expect(theTakeover()).toBeNull();
    expect(theItemBoard()).toBeInTheDocument();
  });

  it("Skip lands on the board with the XP in the bar and no takeover, and LP14: the crossed level's emoji, never played, plays in the arrival emoji pop-up and only then counts as seen", async () => {
    const { actions } = await returnTo({ moment: toLevelTen, album: atLevelTen });
    await at(canvasArrival + 0.2);

    await act(async () => fireEvent.click(within(theCanvas()!).getByRole("button", { name: "Skip" })));

    expect(theTakeover()).toBeNull();
    expect(xpWords()).toBe("772 XP to level 11");
    expect(theItemBoard()).toBeInTheDocument();
    await theLevelEmojiPlaysInThePopUpAndIsThenSeen(actions.markEmojisSeen);
  });

  it("reduced motion lands on the board at once with the XP in the bar, and LP14: the crossed level's emoji, never played, plays in the arrival emoji pop-up and only then counts as seen", async () => {
    preferReducedMotion();
    const { actions } = await returnTo({ moment: toLevelTen, album: atLevelTen });

    expect(theTakeover()).toBeNull();
    expect(xpWords()).toBe("772 XP to level 11");
    expect(theItemBoard()).toBeInTheDocument();
    await theLevelEmojiPlaysInThePopUpAndIsThenSeen(actions.markEmojisSeen);
  });

  it("with xp-moments off the level's emoji pops up on arrival as before", async () => {
    const { actions } = await returnTo({ moment: { kind: "off" }, album: atLevelTen });
    await at(1);

    expect(theEmojiPopUp()).toBeInTheDocument();
    expect(actions.markEmojisSeen).not.toHaveBeenCalled();
  });
});

const newcomersCard = { slack: "https://app.slack.com/client/T1", toLevelTwo: true, kudos: { kudosEmoji: "taco", kudosEmojiImage: null } };

function theHowItWorksCard() {
  return screen.queryByRole("dialog", { name: "How HedgeHug works" });
}

describe("LP67: the how-it-works card opens once, at the end of the arrival's sequence", { timeout: 30_000 }, () => {
  it("opens once the moment's XP and its takeover have landed, before the waiting items, which land when it closes", async () => {
    await returnTo({ album: { ...withLevelSevenItems, howItWorks: newcomersCard } });
    await collectAt(arrivedAndRead);
    expect(theHowItWorksCard(), "while the moment plays").toBeNull();

    await at(collectedAndStreamed + 0.02);
    expect(theTakeover()).toBeInTheDocument();
    expect(theHowItWorksCard(), "while the takeover shows").toBeNull();

    await act(async () => fireEvent.click(theTakeover()!));
    expect(theHowItWorksCard()).toBeInTheDocument();
    expect(theItemBoard(), "the items wait for the card").toBeNull();

    await act(async () => fireEvent.click(within(theHowItWorksCard()!).getByRole("button", { name: "Got it" })));
    expect(theHowItWorksCard()).toBeNull();
    expect(within(theItemBoard()!).getAllByRole("button", { name: "An unidentified item from level 7. Identify it" })).toHaveLength(3);
  });

  it("with nothing waiting, opens once All caught up has left", async () => {
    await returnTo({ moment: quietReturn, album: { ...caughtUp, howItWorks: newcomersCard } });
    await collectAt(canvasArrival + 0.17 + 0.55);
    await at(1.42 + 0.55 + 0.7 + 0.38 + 0.02);
    expect(within(theCanvas()!).getByText("All caught up")).toBeInTheDocument();
    expect(theHowItWorksCard()).toBeNull();

    await inAnother(2.7);

    expect(theCanvas()).toBeNull();
    expect(theHowItWorksCard()).toBeInTheDocument();
  });

  it("with reduced motion, the moment lands at once and the card opens before the items", async () => {
    preferReducedMotion();
    await returnTo({ album: { ...returning, howItWorks: newcomersCard } });

    expect(xpWords()).toBe("460 XP to level 8");
    expect(theHowItWorksCard()).toBeInTheDocument();
    expect(theItemBoard()).toBeNull();
  });
});

const cameInLater: XpMoment = { ...quietReturn, since: busyReturn.until, until: busyReturn.until + 10 * minute };

function theGlow() {
  return theTopBar().queryByRole("button", { name: /^(Collect XP|\d+\+? unidentified items? waits?)$/ });
}

async function closeTheBoard() {
  await act(async () => fireEvent.click(within(theItemBoard()!).getByRole("button", { name: "Later" })));
}

describe("LP61: a glow beside the level bar starts what did not play", { timeout: 30_000 }, () => {
  it("after Later the waiting items glow beside the level bar in place of the pill, and a press opens the board again", async () => {
    await returnTo({ moment: { kind: "none", lastVisit } });
    await at(1);
    expect(theGlow(), "while the board is open").toBeNull();

    await closeTheBoard();

    expect(theGlow()).toHaveAccessibleName("3 unidentified items wait");
    expect(theGlow()!.closest(".al-xp"), "beside the level bar").not.toBeNull();
    expect(screen.getAllByRole("button", { name: "3 unidentified items wait" }), "one control, no pill under the top bar").toEqual([theGlow()]);
    await act(async () => fireEvent.click(theGlow()!));
    expect(theItemBoard()).toBeInTheDocument();
    expect(theGlow(), "once the board is open again").toBeNull();
  });

  it("XP that came in after the visit's read glows beside the level bar, and a press plays that moment once out of the orb and ends it where it read", async () => {
    const { actions, answerWith } = await returnTo({ album: caughtUp, moment: { kind: "none", lastVisit } });
    await at(1);
    expect(theGlow(), "before anything came in").toBeNull();

    await act(async () => answerWith({ ...cameInLater, waiting: 0 }));
    expect(theGlow()).toHaveAccessibleName("Collect XP");
    await act(async () => fireEvent.click(theGlow()!));
    started = Date.now();

    expect(theGlow(), "while it plays").toBeNull();
    await at(canvasArrival + 0.05);
    expect(theCards()).toHaveLength(1);
    expect(theOrb()).toBeInTheDocument();
    await collectAt(canvasArrival + 0.17 + 0.55);
    await at(0.72 + 0.55 + 0.7 + 0.4);
    expect(within(theCanvas()!).getByText(/from 1 moment since/)).toBeInTheDocument();
    expect(within(theCanvas()!).getByText("All caught up")).toBeInTheDocument();
    await at(0.72 + 0.55 + 0.7 + 0.4 + 2.6);
    expect(theCanvas()).toBeNull();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
    expect(actions.endXpMoment).toHaveBeenCalledTimes(1);
    expect(actions.endXpMoment).toHaveBeenCalledWith(cameInLater.since, cameInLater.until, false, { shown: cameInLater.excerpts.length, folded: cameInLater.fold?.count ?? 0 });
    expect(theGlow(), "the moment it collected, while the read still answers it").toBeNull();
  });

  it("after the visit's own moment and Later, a press plays the XP that came in since and then the waiting items, and Skip ends it as skipped", async () => {
    const { actions, answerWith } = await returnTo();
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    await closeTheBoard();
    expect(theGlow(), "the visit's own moment").toHaveAccessibleName("3 unidentified items wait");

    await act(async () => answerWith(cameInLater));
    expect(theGlow()).toHaveAccessibleName("Collect XP");
    await act(async () => fireEvent.click(theGlow()!));
    started = Date.now();
    await at(canvasArrival + 0.2);
    await act(async () => fireEvent.click(within(theCanvas()!).getByRole("button", { name: "Skip" })));

    expect(theCanvas()).toBeNull();
    expect(within(theItemBoard()!).getByText(/from 1 moment since/)).toHaveTextContent("+10 XP from 1 moment since");
    expect(actions.endXpMoment).toHaveBeenCalledTimes(2);
    expect(actions.endXpMoment).toHaveBeenLastCalledWith(cameInLater.since, cameInLater.until, true, { shown: cameInLater.excerpts.length, folded: cameInLater.fold?.count ?? 0 });
  });

  it("reduced motion shows the moment's end state at once when pressed", async () => {
    preferReducedMotion();
    const { actions, answerWith } = await returnTo({ moment: { kind: "none", lastVisit } });
    await closeTheBoard();
    await act(async () => answerWith(cameInLater));

    await act(async () => fireEvent.click(theGlow()!));

    expect(theCanvas()).toBeNull();
    expect(within(theItemBoard()!).getByText(/from 1 moment since/)).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(cameInLater.since, cameInLater.until, false, { shown: cameInLater.excerpts.length, folded: cameInLater.fold?.count ?? 0 });
  });

  it("with nothing waiting there is no glow", async () => {
    await returnTo({ album: caughtUp, moment: { kind: "none", lastVisit } });
    await at(3);

    expect(theGlow()).toBeNull();
  });

  it("with xp-moments off the top bar is unchanged and the pill under it opens the board after Later", async () => {
    await returnTo({ moment: { kind: "off" } });
    await closeTheBoard();

    expect(theGlow()).toBeNull();
    const pill = screen.getByRole("button", { name: "3 unidentified items wait" });
    expect(pill.closest("header")).toBeNull();
    await act(async () => fireEvent.click(pill));
    expect(theItemBoard()).toBeInTheDocument();
  });
});

const saidWhy = { kind: "journey", goal: "Give a kudos to someone", xp: 50, waiting: false, hoggie: true } as const;

const twoNew = { kind: "weekly", goal: "Thank 2 people you haven't thanked before.", xp: 20, waiting: false, hoggie: true } as const;

const twoQuestsDone: XpMoment = { ...busyReturn, quests: [saidWhy, twoNew], climb: { from: standingAt(1392), to: busyReturn.climb.to } };

const questsStart = collectedAndStreamed;

const firstBurst = questsStart + 1.4;

const firstReward = firstBurst + 0.6 + 0.7;

const secondStart = firstReward + 1.1;

const secondBurst = secondStart + 0.7;

const secondReward = secondBurst + 0.6 + 0.7;

const questsLanded = secondReward + 1.1;

function theQuest() {
  return theCanvas() === null ? null : within(theCanvas()!).queryByRole("article", { name: /^(A quest finished|Quest complete)/ });
}

async function finishQuests(visit: Visit = {}) {
  const view = await returnTo({ moment: twoQuestsDone, album: withLevelSevenItems, ...visit });
  await collectAt(arrivedAndRead);
  return view;
}

describe("LP104: each quest finished since the last visit gets its own beat", { timeout: 30_000 }, () => {
  it("after the excerpts' XP fills the bar, a sealed quest charges up giving nothing away, then bursts open with Quest complete, its goal and its bonus XP", async () => {
    await finishQuests();

    await at(questsStart - 0.1);
    expect(theQuest()).toBeNull();
    await at(questsStart + 0.02);
    expect(xpWords(), "the excerpts' XP landed").toBe("530 XP to level 8");
    expect(theTakeover()).toBeNull();
    expect(theQuest()).toHaveAccessibleName("A quest finished");
    expect(theQuest()).toHaveAttribute("data-stage", "charge");
    expect(theQuest()).not.toHaveTextContent(/says why|XP/);
    await at(firstBurst - 0.05);
    expect(theQuest()).toHaveAttribute("data-stage", "charge");
    await at(firstBurst + 0.06);
    expect(theQuest()).toHaveAccessibleName("Quest complete: Give a kudos to someone");
    expect(theQuest()).toHaveTextContent("+50 XP");
    expect(xpWords(), "nothing streamed yet").toBe("530 XP to level 8");
  });

  it("streams its bonus XP into the bar on its own, then the hoggie it earned comes out of it face down, and the next quest follows quickly", async () => {
    await finishQuests();

    await at(firstBurst + 0.6 + 0.4);
    expect(xpWords(), "halfway through the quest's stream").toBe("505 XP to level 8");
    await at(firstReward + 0.06);
    expect(xpWords()).toBe("480 XP to level 8");
    expect(theQuest()).toHaveAttribute("data-stage", "reward");
    expect(within(theQuest()!).getByText("An unidentified hoggie")).toBeInTheDocument();
    expect(theQuest()!.querySelector(".ib-back")).not.toBeNull();

    await at(secondStart + 0.06);
    expect(theQuest()).toHaveAccessibleName("A quest finished");
    await at(secondBurst + 0.06);
    expect(theQuest()).toHaveAccessibleName("Quest complete: Thank 2 people you haven't thanked before.");
    await at(secondReward + 0.06);
    expect(xpWords()).toBe("460 XP to level 8");
  });

  it("after the last quest the level-up takeover plays", async () => {
    await finishQuests();

    await at(questsLanded - 0.1);
    expect(theTakeover()).toBeNull();
    await at(questsLanded + 0.06);
    expect(theQuest()).toBeNull();
    expect(theTakeover()).toBeInTheDocument();
  });

  it("a quest whose XP alone crosses the level plays the takeover after its beat", async () => {
    const crossedByTheQuest: XpMoment = { ...busyReturn, quests: [saidWhy], climb: { from: standingAt(1460), to: standingAt(1520) } };
    await returnTo({ moment: crossedByTheQuest, album: { ...withLevelSevenItems, level: crossedByTheQuest.climb.to } });
    await collectAt(arrivedAndRead);

    await at(firstBurst + 0.06);
    expect(xpWords(), "the excerpts' XP stays below level 7").toBe("30 XP to level 7");
    await at(firstReward + 0.06);
    expect(xpWords(), "the quest's XP crossed it").toBe("580 XP to level 8");
    expect(theTakeover()).toBeNull();
    await at(secondStart + 0.06);
    expect(theTakeover()).toHaveAccessibleName("You reached level 7");
  });

  it("a moment answered without quests or progress, as by the backend before them during a revert, plays as before", async () => {
    const { quests: _, progressed: __, ...answeredBeforeQuests } = busyReturn;
    await returnTo({ moment: answeredBeforeQuests as XpMoment, album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(collectedAndStreamed + 0.02);
    expect(theQuest()).toBeNull();
    expect(theTakeover()).toBeInTheDocument();
    await act(async () => fireEvent.click(theTakeover()!));
    expect(within(theItemBoard()!).queryAllByRole("listitem", { name: /^Quest complete|progressed/ })).toEqual([]);
  });

  it("a quest whose reward waits in its crate streams no XP and says its reward waits there", async () => {
    await returnTo({ moment: { ...busyReturn, quests: [{ ...twoNew, waiting: true }] }, album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(firstReward + 0.06);
    expect(theQuest()).toHaveTextContent("+20 XP");
    expect(within(theQuest()!).getByText("Its reward waits in your crate")).toBeInTheDocument();
    expect(theQuest()!.querySelector(".ib-back")).toBeNull();
    expect(xpWords()).toBe("460 XP to level 8");
  });

  it("Skip and Esc land every quest's XP at once, end the moment as skipped and list the quests under the summary", async () => {
    for (const land of [() => fireEvent.click(within(theCanvas()!).getByRole("button", { name: "Skip" })), () => fireEvent.keyDown(window, { key: "Escape" })]) {
      const { actions, unmount } = await finishQuests();
      await at(firstBurst + 0.06);

      await act(async () => land());

      expect(theCanvas()).toBeNull();
      expect(xpWords()).toBe("460 XP to level 8");
      expect(within(theItemBoard()!).getAllByRole("listitem", { name: /^Quest complete/ }).map((quest) => quest.textContent)).toEqual(["Quest complete: Give a kudos to someone+50 XP", "Quest complete: Thank 2 people you haven't thanked before.+20 XP"]);
      expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
      unmount();
      vi.useRealTimers();
    }
  });

  it("reduced motion shows the end state at once with each quest listed under the summary and no beat", async () => {
    preferReducedMotion();
    await returnTo({ moment: { ...twoQuestsDone, quests: [saidWhy, { ...twoNew, waiting: true }] } });

    expect(theCanvas()).toBeNull();
    expect(within(theItemBoard()!).getAllByRole("listitem", { name: /^Quest complete/ }).map((quest) => quest.textContent)).toEqual(["Quest complete: Give a kudos to someone+50 XP", "Quest complete: Thank 2 people you haven't thanked before.+20 XP waits in your crate"]);
  });

  it("with no quest finished the summary lists none and the takeover follows the bar as before", async () => {
    await returnTo({ album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(collectedAndStreamed + 0.02);
    expect(theQuest()).toBeNull();
    expect(theTakeover()).toBeInTheDocument();
    await act(async () => fireEvent.click(theTakeover()!));
    expect(within(theItemBoard()!).queryAllByRole("listitem", { name: /^Quest complete/ })).toEqual([]);
  });
});

const twoNewMoved = { kind: "quest", name: "Thank 2 people you haven't thanked before", from: 0, to: 1, of: 2 } as const;

const generousSoul = { kind: "milestone", name: "Generous soul", from: 7, to: 9, of: 25 } as const;

const progressStart = collectedAndStreamed;

const progressFilled = progressStart + 0.3;

const secondProgressStart = progressStart + 1.7;

const progressLanded = secondProgressStart + 1.7;

function theProgress() {
  return theCanvas() === null ? null : within(theCanvas()!).queryByRole("article", { name: /progressed/ });
}

function theProgressBar() {
  return within(theProgress()!).getByRole("progressbar");
}

describe("LP107: each quest or milestone that progressed since the last visit gets its own beat", { timeout: 30_000 }, () => {
  it("after the bar fills, each plays a short beat whose bar moves from where it stood at the last visit to now, and the takeover follows the last", async () => {
    await returnTo({ moment: { ...busyReturn, progressed: [twoNewMoved, generousSoul] }, album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(progressStart - 0.1);
    expect(theProgress()).toBeNull();
    await at(progressStart + 0.06);
    expect(theProgress()).toHaveAccessibleName("Quest progressed: Thank 2 people you haven't thanked before");
    expect(theProgressBar()).toHaveAttribute("aria-valuenow", "0");
    expect(theProgressBar()).toHaveAttribute("aria-valuemax", "2");
    expect(theProgress()).toHaveTextContent("0 of 2");
    expect(theTakeover()).toBeNull();
    await at(progressFilled + 0.06);
    expect(theProgressBar()).toHaveAttribute("aria-valuenow", "1");
    expect(theProgress()).toHaveTextContent("1 of 2");

    await at(secondProgressStart + 0.06);
    expect(theProgress()).toHaveAccessibleName("Milestone progressed: Generous soul");
    expect(theProgress()).toHaveTextContent("7 of 25");
    await at(secondProgressStart + 0.3 + 0.06);
    expect(theProgress()).toHaveTextContent("9 of 25");

    await at(progressLanded - 0.1);
    expect(theTakeover()).toBeNull();
    await at(progressLanded + 0.06);
    expect(theProgress()).toBeNull();
    expect(theTakeover()).toBeInTheDocument();
  });

  it("plays after the quests that finished", async () => {
    await returnTo({ moment: { ...twoQuestsDone, progressed: [twoNewMoved] }, album: withLevelSevenItems });
    await collectAt(arrivedAndRead);

    await at(questsLanded - 0.1);
    expect(theProgress()).toBeNull();
    await at(questsLanded + 0.06);
    expect(theQuest()).toBeNull();
    expect(theProgress()).toHaveAccessibleName("Quest progressed: Thank 2 people you haven't thanked before");
  });

  it("Skip and Esc land everything and list what progressed under the summary, as reduced motion shows at once", async () => {
    const listed = () => within(theItemBoard()!).getAllByRole("listitem", { name: /progressed/ }).map((moved) => moved.textContent);
    const shownUnderTheSummary = ["Thank 2 people you haven't thanked before · 1 of 2", "Generous soul · 9 of 25"];
    for (const land of [() => fireEvent.click(within(theCanvas()!).getByRole("button", { name: "Skip" })), () => fireEvent.keyDown(window, { key: "Escape" })]) {
      const { actions, unmount } = await returnTo({ moment: { ...busyReturn, progressed: [twoNewMoved, generousSoul] }, album: withLevelSevenItems });
      await collectAt(arrivedAndRead);
      await at(progressFilled + 0.06);

      await act(async () => land());

      expect(theCanvas()).toBeNull();
      expect(listed()).toEqual(shownUnderTheSummary);
      expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true, { shown: busyReturn.excerpts.length, folded: busyReturn.fold!.count });
      unmount();
      vi.useRealTimers();
    }

    preferReducedMotion();
    await returnTo({ moment: { ...busyReturn, progressed: [twoNewMoved, generousSoul] } });
    expect(theCanvas()).toBeNull();
    expect(listed()).toEqual(shownUnderTheSummary);
  });
});
