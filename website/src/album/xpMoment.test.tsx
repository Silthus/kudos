import { act, fireEvent, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../../convex/activity/entries";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { shellFixtures, type ArrivalReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album, XpMomentRead, XpMomentShown } from "./answer";

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

function sizeTheWindow({ width, height }: { width: number; height: number }) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

let started = 0;

type Visit = { moment?: XpMomentShown; album?: Album; screenSize?: { width: number; height: number }; endXpMoment?: (from: number, until: number, skipped: boolean) => Promise<ArrivalReply> };

async function returnTo({ moment = busyReturn, album = returning, screenSize = desktop, endXpMoment }: Visit = {}) {
  window.history.replaceState(null, "", "/book#me");
  sizeTheWindow(screenSize);
  const later = aMomentAnsweredLater();
  const view = renderAlbum(shellFixtures.member, fixedAlbum(album), { xpMoment: later.read, people: fixedPeople(album), commands: endXpMoment === undefined ? {} : { endXpMoment } });
  await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });
  vi.useFakeTimers();
  started = Date.now();
  await act(async () => later.answerWith(moment));
  return view;
}

const frameMs = 16;

async function at(seconds: number) {
  const due = started + Math.round(seconds * 1000);
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(Math.min(frameMs, due - Date.now())));
}

async function collectAt(seconds: number) {
  await at(seconds);
  started = Date.now();
  await act(async () => fireEvent.click(theCanvas()!));
}

function theCanvas() {
  return screen.queryByRole("dialog", { name: "Since your last visit" });
}

function theCards() {
  return [...(theCanvas()?.querySelectorAll<HTMLElement>(".xpm-card") ?? [])];
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

function theItemBoard() {
  return screen.queryByRole("dialog", { name: "Your items" });
}

function px(card: HTMLElement, property: "left" | "top") {
  return Number.parseFloat(card.style[property]);
}

function degreesOf(card: HTMLElement) {
  return Number.parseFloat(card.style.getPropertyValue("--rot"));
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

  it("shows each kind as a Slack-style excerpt with its own XP chip, senders as initials on a colour, HedgeHug's own message with the sitting hedgehog, and the fold line with its XP", async () => {
    await returnTo();
    await at(arrivedAndRead);

    const [fromInes, hugs, given, fromBram, level] = theCards().map((card) => within(card));
    expect(fromInes!.getByRole("article", { name: "Kudos for you" })).toHaveTextContent("Ines Okafor");
    expect(fromInes!.getByText("IO", { selector: ".xpm-avatar" })).toHaveAttribute("data-tone");
    expect(fromInes!.getByText("thank you for pairing on the flaky deploy")).toBeInTheDocument();
    expect(fromInes!.getByText("+10 XP")).toBeInTheDocument();
    expect(hugs!.getByRole("article", { name: "3 hugs on your message" })).toHaveTextContent("+3 XP");
    expect(given!.getByRole("article", { name: "Kudos you gave" })).toHaveTextContent("Sam Example");
    expect(given!.getByText("+15 XP")).toBeInTheDocument();
    expect(fromBram!.getByRole("article", { name: "Kudos for you" })).toHaveTextContent("Bram Teller");
    expect(level!.getByRole("article", { name: "Level up" })).toHaveTextContent("You reached level 7!");
    expect(level!.getByRole("article", { name: "Level up" }).querySelector(".xpm-avatar-app img")).not.toBeNull();
    expect(level!.queryByText(/XP$/)).toBeNull();
    expect(theCards()[5]).toHaveTextContent("+12 more kudos and hugs+140 XP");
    expect(theCards()[0]).toHaveTextContent("Mon 09:22");
  });

  it("rings the orb on a desktop: 370 by 196 px around its centre, each excerpt tilted up to 7°", async () => {
    await returnTo();
    await at(arrivedAndRead);

    const orb = { x: px(theOrb(), "left"), y: px(theOrb(), "top") };
    const reaches = theCards().map((card) => Math.hypot((px(card, "left") - orb.x) / 370, (px(card, "top") - orb.y) / 196));
    expect(Math.min(...reaches)).toBeGreaterThan(0.9);
    expect(Math.max(...reaches)).toBeLessThan(1.1);
    expect(theCards().every((card) => Math.abs(degreesOf(card)) <= 7)).toBe(true);
    expect(new Set(theCards().map((card) => Math.sign(px(card, "left") - orb.x))).size).toBeGreaterThan(1);
  });

  it("on a phone the orb sits under the excerpts", async () => {
    await returnTo({ screenSize: phone });
    await at(arrivedAndRead);

    expect(theCanvas()).toHaveAttribute("data-narrow");
    const lowestCard = Math.max(...theCards().map((card) => px(card, "top")));
    expect(px(theOrb(), "top")).toBeGreaterThan(lowestCard);
    expect(px(theOrb(), "left")).toBe(phone.width / 2);
  });
});

describe("LP31 LP32: collecting streams the XP into the bar and the canvas becomes the item board", { timeout: 30_000 }, () => {
  it("collects on its own after 2 s plus 0.7 s per excerpt once they are out: 6.2 s for six", async () => {
    await returnTo();

    await at(arrivedAndRead + 6.2 - 0.1);
    expect(theOrbSays()).toBe("?");
    expect(theCards().some((card) => card.hasAttribute("data-dissolving"))).toBe(false);
    await at(arrivedAndRead + 6.2 + 0.05);
    expect(theOrbSays()).toBe("+0");
    expect(theCards()[0]).toHaveAttribute("data-dissolving");
  });

  it("a click anywhere collects: the excerpts dissolve 140 ms apart over 720 ms while the orb counts up from +0 to the total", async () => {
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
    expect(theCanvas()).toBeNull();
    const board = within(theItemBoard()!);
    expect(board.getByText(/from 16 moments since/)).toHaveTextContent("+178 XP from 16 moments since Mon 09:12");
    expect(board.getByText("4 teammates gave thoughtful kudos this week")).toBeInTheDocument();
    expect(board.getAllByRole("button", { name: "A face-down item. Turn it over" })).toHaveLength(3);
    expect(board.getByRole("button", { name: "Later" })).toBeInTheDocument();
    expect(document.querySelector(".al-shell")).not.toHaveAttribute("data-xp-moment");
    expect(actions.endXpMoment).toHaveBeenCalledTimes(1);
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, false);
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
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true);
  });

  it("Esc lands everything at once too", async () => {
    const { actions } = await returnTo();
    await at(arrivedAndRead + 1);

    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));

    expect(theCanvas()).toBeNull();
    expect(theItemBoard()).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, true);
  });

  it("reduced motion shows the end state at once", async () => {
    preferReducedMotion();
    const { actions } = await returnTo();

    expect(theCanvas()).toBeNull();
    expect(xpWords()).toBe("460 XP to level 8");
    expect(within(theItemBoard()!).getByText(/from 16 moments since/)).toBeInTheDocument();
    expect(actions.endXpMoment).toHaveBeenCalledWith(busyReturn.since, busyReturn.until, false);
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
