import { act, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type ArrivalReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedPeople } from "./albumFixtures";
import type { Album, AlbumHoggies, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const day = 86_400_000;
const now = Date.parse("2026-10-18T10:00:00Z");
const lastVisit = now - 2 * day;
const sinceTheLastVisit = now - day;
const beforeTheLastVisit = now - 10 * day;
const quietHarbour = "/book#teams/quiet-harbour";
const theAlbumLoads = { timeout: 10_000 };

const midwayHoggies = hoggiesFixtures.midway as AlbumHoggies;
const newHoggie = midwayHoggies.hoggies.find(({ found }) => found)!;

const visitedAlbum: Album = {
  ...albumFixtures.midway,
  lastVisit,
  teams: albumFixtures.midway.teams.map((team) => (team.team === "quiet-harbour" ? { ...team, unlockedAt: sinceTheLastVisit } : team)),
  people: albumFixtures.midway.people.map((person) => (person.held ? { ...person, at: person.person === "perrin-holt" ? sinceTheLastVisit : beforeTheLastVisit } : person)),
};

const visitedHoggies: AlbumHoggies = { ...midwayHoggies, hoggies: midwayHoggies.hoggies.map((hoggie) => (hoggie.found ? { ...hoggie, firstAt: hoggie === newHoggie ? sinceTheLastVisit : beforeTheLastVisit } : hoggie)) };

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

const movedOn = async (): Promise<ArrivalReply> => ({ kind: "arrived", lastVisit: sinceTheLastVisit });

function visit(album: Album, { path = quietHarbour, arrive = movedOn } = {}) {
  window.history.replaceState(null, "", path);
  const live = anAlbumThatAnswers(album);
  const view = renderAlbum(shellFixtures.member, live.read, { hoggies: fixedHoggies(visitedHoggies), people: fixedPeople(album), commands: { arrive } });
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
  it("labels a sticker, a team sticker and a hoggie plate put in after the last visit once the shell has arrived, and nothing put in before it", async () => {
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
    await act(async () => arrival.resolve({ kind: "arrived", lastVisit: sinceTheLastVisit }));

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
    expect(actions.arrive).toHaveBeenCalledWith(lastVisit);
  });

  it("keeps the labels when the member comes back to the page in the same visit, after the arrival moved the last visit, without arriving again", async () => {
    const { user, actions, answerNext } = visit(visitedAlbum);
    await within(await photoPerson("Perrin Holt")).findByText("New");

    answerNext({ ...visitedAlbum, lastVisit: sinceTheLastVisit });
    await goTo(user, /^Hoggies/);
    await screen.findAllByRole("button", { name: /, new$/ });
    await goTo(user, /^Quiet Harbour/);

    expect(await within(await photoPerson("Perrin Holt")).findByText("New")).toBeVisible();
    expect(within(await sealTag()).getByText("New")).toBeVisible();
    expect(actions.arrive).toHaveBeenCalledTimes(1);
  });

  it("clears the labels at the next visit, which reads the moved last visit", async () => {
    const { unmount } = visit(visitedAlbum);
    await within(await photoPerson("Perrin Holt")).findByText("New");

    unmount();
    const { actions } = visit({ ...visitedAlbum, lastVisit: sinceTheLastVisit });
    expect(await screen.findByText(/^Unlocked /, {}, theAlbumLoads)).toBeVisible();
    await act(async () => {});

    expect(actions.arrive).toHaveBeenCalledWith(sinceTheLastVisit);
    expect(newLabels()).toEqual([]);
  });

  it("labels nothing on the first visit, which has no last visit to compare against", async () => {
    const { actions } = visit({ ...visitedAlbum, lastVisit: null });
    await photoPerson("Perrin Holt");
    await act(async () => {});

    expect(actions.arrive).toHaveBeenCalledWith(null);
    expect(newLabels()).toEqual([]);
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
