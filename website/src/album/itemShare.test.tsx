import { act, fireEvent, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { shellFixtures, type ShareReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const [win, other] = albumFixtures.withItems.board!.items;

const arrival = 10_000;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
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
  const answers = (change: (album: Album) => Album) => {
    answer = change(answer);
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answers };
}

function visit({ offeredAfterTheTurn, shareItem = async () => ({ kind: "shared" }) }: { offeredAfterTheTurn: Id<"items">[] | undefined; shareItem?: (item: string) => Promise<ShareReply> }) {
  window.history.replaceState(null, "", "/book#me");
  const live = anAlbumThatAnswers({ ...albumFixtures.withItems, board: { items: [win!, other!], more: false } });
  const turnItem = async (item: string) => {
    live.answers((album) => ({ ...album, board: { items: album.board!.items.filter((waiting) => waiting.item !== item), more: false }, ...(offeredAfterTheTurn !== undefined && { shares: offeredAfterTheTurn }) }));
    return fixtureTurnOf(item);
  };
  return { ...renderAlbum(shellFixtures.member, live.read, { hoggies: fixedHoggies(hoggiesFixtures.midway), commands: { turnItem, shareItem } }), live };
}

async function turnTheFirstItem(user: ReturnType<typeof visit>["user"]) {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }, { timeout: arrival }));
  await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
  await screen.findByRole("heading", { level: 1, name: "Hoggies" }, { timeout: arrival });
}

function theShareButton() {
  return screen.queryByRole("button", { name: "Share" });
}

describe("LP51 LP52: Share shows after a turn the album offers it for, and is gone after the press", { timeout: 60_000 }, () => {
  beforeEach(() => {
    preferReducedMotion();
  });

  it("shows Share beside what turned over when the album offers the turned item, and the press shares that item, takes the button away and says it was shared", async () => {
    const { user, actions } = visit({ offeredAfterTheTurn: [win!.item] });
    expect(theShareButton()).toBeNull();

    await turnTheFirstItem(user);
    await user.click(theShareButton()!);

    expect(actions.shareItem).toHaveBeenCalledWith(win!.item);
    expect(theShareButton()).toBeNull();
    expect(screen.getByRole("status", { name: "Shared" })).toHaveTextContent("Shared with your workspace");
  });

  it.each([
    { condition: "offers nothing", offered: undefined },
    { condition: "offers no win", offered: [] },
    { condition: "offers another item", offered: [other!.item] },
  ])("shows no Share after a turn when the album $condition", async ({ offered }) => {
    const { user } = visit({ offeredAfterTheTurn: offered });

    await turnTheFirstItem(user);

    expect(theShareButton()).toBeNull();
  });

  it("takes the button away once the album stops offering the win, as after a press in another tab", async () => {
    const { user, live } = visit({ offeredAfterTheTurn: [win!.item] });
    await turnTheFirstItem(user);
    expect(theShareButton()).not.toBeNull();

    live.answers((album) => ({ ...album, shares: [] }));

    expect(theShareButton()).toBeNull();
  });

  it("says so when the press is refused, and offers no second press", async () => {
    const { user } = visit({ offeredAfterTheTurn: [win!.item], shareItem: async () => ({ kind: "refused" }) });
    await turnTheFirstItem(user);

    await user.click(theShareButton()!);

    expect(screen.getByRole("alert")).toHaveTextContent("That win couldn't be shared.");
    expect(theShareButton()).toBeNull();
  });

  it("says HedgeHug can't be reached when the press gets no answer, and keeps the button so a second press tries again", async () => {
    let presses = 0;
    const shareItem = async (): Promise<ShareReply> => {
      presses += 1;
      if (presses === 1) throw new Error("timed out");
      return { kind: "shared" };
    };
    const { user, actions } = visit({ offeredAfterTheTurn: [win!.item], shareItem });
    await turnTheFirstItem(user);

    await user.click(theShareButton()!);
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach HedgeHug. Try again.");
    await user.click(theShareButton()!);

    expect(actions.shareItem).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status", { name: "Shared" })).toHaveTextContent("Shared with your workspace");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

async function theFaceDownItems() {
  await screen.findByRole("dialog", { name: "Your items" }, { timeout: arrival });
  return theFaceDownItemsNow();
}

function theFaceDownItemsNow() {
  return within(screen.getByRole("dialog", { name: "Your items" })).getAllByRole("button", { name: "A face-down item. Turn it over" });
}

let clicked = 0;

async function clickOnFakeTime(item: HTMLElement) {
  if (!vi.isFakeTimers()) vi.useFakeTimers();
  clicked = Date.now();
  await act(async () => fireEvent.click(item));
}

const frameMs = 16;

async function after(seconds: number) {
  const due = clicked + Math.round(seconds * 1000);
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(Math.min(frameMs, due - Date.now())));
}

const theSequenceIsOver = 6;

async function turnOnFakeTime(item: HTMLElement) {
  await clickOnFakeTime(item);
  await after(theSequenceIsOver);
}

describe("LP51 LP52: with full motion, Share shows for every win of the visit while another item still waits", { timeout: 60_000 }, () => {
  it("shows Share on the board that comes back after the win lands, and the press shares the win", async () => {
    const { actions } = visit({ offeredAfterTheTurn: [win!.item] });
    const [first] = await theFaceDownItems();

    await turnOnFakeTime(first!);
    const board = within(screen.getByRole("dialog", { name: "Your items" }));
    await act(async () => fireEvent.click(board.getByRole("button", { name: "Share" })));

    expect(actions.shareItem).toHaveBeenCalledWith(win!.item);
    expect(board.getByRole("status", { name: "Shared" })).toHaveTextContent("Shared with your workspace");
  });

  it("keeps the win's Share once the next item has turned, so the press still shares the win", async () => {
    const { actions } = visit({ offeredAfterTheTurn: [win!.item] });
    const [first] = await theFaceDownItems();
    await turnOnFakeTime(first!);
    const [next] = theFaceDownItemsNow();

    await turnOnFakeTime(next!);
    expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull();
    await act(async () => fireEvent.click(theShareButton()!));

    expect(actions.shareItem).toHaveBeenCalledWith(win!.item);
  });

  it("shows no Share on the board that comes back when the album offers no win", async () => {
    visit({ offeredAfterTheTurn: [] });
    const [first] = await theFaceDownItems();

    await turnOnFakeTime(first!);

    expect(screen.getByRole("dialog", { name: "Your items" })).toBeInTheDocument();
    expect(theShareButton()).toBeNull();
  });
});
