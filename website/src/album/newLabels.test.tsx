import { act, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../../convex/activity/entries";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { shellFixtures, type ArrivalReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedPeople } from "./albumFixtures";
import type { Album, AlbumHoggies, AlbumRead, XpMomentRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const day = 86_400_000;
const now = Date.parse("2026-10-18T10:00:00Z");
const lastVisit = now - 3 * day;
const putInBeforeArriving = now - 2 * day;
const turnedThisVisit = now - day;
const turnedNextVisit = now;
const beforeTheLastVisit = now - 10 * day;
const quietHarbour = "/book#teams/quiet-harbour";
const theAlbumLoads = { timeout: 10_000 };

const midwayHoggies = hoggiesFixtures.midway as AlbumHoggies;
const newHoggie = midwayHoggies.hoggies.find(({ found }) => found)!;

const visitedAlbum: Album = {
  ...albumFixtures.midway,
  lastVisit,
  teams: albumFixtures.midway.teams.map((team) => (team.team === "quiet-harbour" ? { ...team, unlockedAt: turnedThisVisit } : team)),
  people: albumFixtures.midway.people.map((person) => (person.held ? { ...person, at: putInAtOf(person.person) } : person)),
};

function putInAtOf(person: string) {
  if (person === "perrin-holt") return turnedThisVisit;
  return person === "ada-quill" ? putInBeforeArriving : beforeTheLastVisit;
}

const visitedHoggies: AlbumHoggies = { ...midwayHoggies, hoggies: midwayHoggies.hoggies.map((hoggie) => (hoggie.found ? { ...hoggie, firstAt: hoggie === newHoggie ? turnedThisVisit : beforeTheLastVisit } : hoggie)) };

const nothingPutIn: Album = {
  ...visitedAlbum,
  lastVisit: null,
  teams: visitedAlbum.teams.map((team) => ({ ...team, unlockedAt: null })),
  people: visitedAlbum.people.map(({ at: _at, ...person }) => ({ ...person, held: false })),
};

const decidedWhileTheMomentBeforePlayed = putInBeforeArriving;

const words = (text: string): Message => ({ kind: "text", segments: [{ kind: "text", text }], edited: false });

const { level, xp, startsAt, nextAt } = albumFixtures.midway.level;

const momentOfWhatWaited: XpMoment = {
  kind: "moment",
  since: lastVisit,
  until: decidedWhileTheMomentBeforePlayed,
  excerpts: [{ entry: { kind: "kudosReceived", key: "k1", at: decidedWhileTheMomentBeforePlayed, giver: { name: "Ines Okafor", face: { kind: "initials", initials: "IO" } }, channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("thank you for pairing on the flaky deploy") }, xp: 5 }],
  fold: null,
  moments: 1,
  xp: 5,
  climb: { from: { level, xp: xp - 5, startsAt, nextAt }, to: { level, xp, startsAt, nextAt } },
  quests: [],
  waiting: 0,
  thoughtfulGivers: null,
  timeZone: "UTC",
};

const thePlayingMoment: XpMomentRead = (asking) => (asking ? momentOfWhatWaited : undefined);

const perrinTurned: Album = { ...nothingPutIn, people: nothingPutIn.people.map((person) => (person.person === "perrin-holt" ? { ...person, held: true, at: turnedThisVisit } : person)) };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
  const answerNext = (next: Album) => {
    answer = next;
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answerNext };
}

const arrivedAt = (moved: number | null) => async (): Promise<ArrivalReply> => ({ kind: "arrived", lastVisit: moved });

const movedOn = arrivedAt(putInBeforeArriving);

type Visit = { path?: string; arrive?: () => Promise<ArrivalReply>; xpMoment?: XpMomentRead; endXpMoment?: () => Promise<ArrivalReply> };

function visit(album: Album, { path = quietHarbour, arrive = movedOn, xpMoment, endXpMoment }: Visit = {}) {
  window.history.replaceState(null, "", path);
  const live = anAlbumThatAnswers(album);
  const view = renderAlbum(shellFixtures.member, live.read, { hoggies: fixedHoggies(visitedHoggies), people: fixedPeople(album), xpMoment, commands: { arrive, ...(endXpMoment !== undefined && { endXpMoment }) } });
  return { ...view, ...live };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

async function photoPerson(name: string) {
  return (await screen.findByRole("link", { name: new RegExp(`^${name}`) }, theAlbumLoads)).closest("li")!;
}

async function sealTag() {
  return (await screen.findByText(/^Unlocked /)).closest("p")!;
}

function newLabels() {
  return screen.queryAllByText("New", { selector: ".ib-new" });
}

async function goTo(user: ReturnType<typeof visit>["user"], link: RegExp) {
  const [side] = screen.getAllByRole("navigation", { name: "Album" });
  await user.click(within(side!).getByRole("link", { name: link }));
}

describe("LP22: what was put in since the last visit carries New on its page", { timeout: 30_000 }, () => {
  it("labels a sticker, a team sticker and a hoggie plate put in after the last visit the arrival answered, and nothing put in before it, even while getAlbum still reads the last visit before the arrival", async () => {
    const { user } = visit(visitedAlbum);

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(within(await photoPerson("Ada Quill")).queryByText("New")).toBeNull();
    expect(within(await sealTag()).getByText("New")).toBeVisible();
    await goTo(user, /^Hoggies/);
    const labelled = await screen.findAllByRole("button", { name: /, new$/ });
    expect(labelled.map((plate) => plate.dataset.hoggie)).toEqual([newHoggie.hoggie]);
    expect(within(labelled[0]!).getByText("New")).toBeVisible();
  });

  it("labels the sticker on its person page too", async () => {
    visit(visitedAlbum, { path: "/book#people/perrin-holt" });

    expect(await within(await screen.findByText("In your album", { selector: "figcaption" }, theAlbumLoads)).findByText("New")).toBeVisible();
  });

  it("arrives once a visit with the last visit it read, and shows no label until the arrival answers", async () => {
    const arrival = deferred<ArrivalReply>();
    const { actions } = visit(visitedAlbum, { arrive: () => arrival.promise });

    await photoPerson("Perrin Holt");
    expect(newLabels()).toEqual([]);
    await act(async () => arrival.resolve({ kind: "arrived", lastVisit: putInBeforeArriving }));

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
    expect(actions.arrive).toHaveBeenCalledWith(lastVisit);
  });

  it("keeps the labels when the member comes back to the page in the same visit, after the arrival moved the last visit, without arriving again", async () => {
    const { user, actions, answerNext } = visit(visitedAlbum);
    await within(await photoPerson("Perrin Holt")).findByText("New");

    answerNext({ ...visitedAlbum, lastVisit: putInBeforeArriving });
    await goTo(user, /^Hoggies/);
    await screen.findAllByRole("button", { name: /, new$/ });
    await goTo(user, /^Quiet Harbour/);

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(within(await sealTag()).getByText("New")).toBeVisible();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
  });

  it("clears the labels at the next visit, once its arrival moves the last visit past what the visit before turned", async () => {
    const { unmount } = visit(visitedAlbum);
    await within(await photoPerson("Perrin Holt")).findByText("New");

    unmount();
    const { actions } = visit({ ...visitedAlbum, lastVisit: putInBeforeArriving }, { arrive: arrivedAt(turnedThisVisit) });
    expect(await screen.findByText(/^Unlocked /, {}, theAlbumLoads)).toBeVisible();
    await act(async () => {});

    expect(actions.arrive).toHaveBeenCalledWith(putInBeforeArriving);
    expect(newLabels()).toEqual([]);
  });

  it("labels what the next visit turns after its arrival", async () => {
    const { answerNext } = visit({ ...visitedAlbum, lastVisit: putInBeforeArriving }, { arrive: arrivedAt(turnedThisVisit) });
    await photoPerson("Perrin Holt");
    await act(async () => {});
    expect(newLabels()).toEqual([]);

    answerNext({ ...visitedAlbum, lastVisit: turnedThisVisit, people: visitedAlbum.people.map((person) => (person.person === "ada-quill" ? { ...person, at: turnedNextVisit } : person)) });

    expect(await within(await photoPerson("Ada Quill")).findByText("New")).toBeVisible();
    expect(within(await photoPerson("Perrin Holt")).queryByText("New")).toBeNull();
  });

  it("clears what the visit before turned after its moment ended once this visit's moment ends, though the moment read only what was decided before those turns, and labels what this visit turns after it", async () => {
    preferReducedMotion();
    const { actions, answerNext } = visit(visitedAlbum, { xpMoment: thePlayingMoment, endXpMoment: arrivedAt(turnedThisVisit) });
    expect(await screen.findByText(/^Unlocked /, {}, theAlbumLoads)).toBeVisible();
    await act(async () => {});

    expect(actions.endXpMoment).toHaveBeenCalledWith(lastVisit, decidedWhileTheMomentBeforePlayed, false);
    expect(actions.arrive).not.toHaveBeenCalled();
    expect(newLabels()).toEqual([]);

    answerNext({ ...visitedAlbum, people: visitedAlbum.people.map((person) => (person.person === "ada-quill" ? { ...person, at: turnedNextVisit } : person)) });

    expect(await within(await photoPerson("Ada Quill")).findByText("New")).toBeVisible();
    expect(within(await photoPerson("Perrin Holt")).queryByText("New")).toBeNull();
  });

  it("labels what a first visit turns when its arrival finds nothing put in yet", async () => {
    const { actions, answerNext } = visit(nothingPutIn, { arrive: arrivedAt(null) });
    await photoPerson("Perrin Holt");
    await act(async () => {});

    answerNext(perrinTurned);

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(actions.arrive).toHaveBeenCalledWith(null);
  });

  it("labels on a first visit only what is turned after its arrival, and nothing put in before the first visit", async () => {
    visit({ ...visitedAlbum, lastVisit: null });

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(within(await photoPerson("Ada Quill")).queryByText("New")).toBeNull();
    expect(newLabels()).toHaveLength(2);
  });

  it("with hidden-items off the album answers no last visit, so the shell never arrives and nothing carries New", async () => {
    const { user, actions } = visit({ ...visitedAlbum, lastVisit: undefined });

    await photoPerson("Perrin Holt");
    await goTo(user, /^Hoggies/);
    await screen.findAllByRole("button", { name: new RegExp(`^${newHoggie.name}`) });

    expect(newLabels()).toEqual([]);
    expect(actions.arrive).not.toHaveBeenCalled();
  });
});
