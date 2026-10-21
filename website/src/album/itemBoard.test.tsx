import { act, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixtureTurnOf } from "./albumFixtures";
import type { BoardItem } from "../../../convex/website/album";
import type { Album, AlbumRead, LevelUpRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedLevelUp, levelUpFixtures } from "./levelUpFixtures";

const memberWithTheAlbum = shellFixtures.member;

const withItems = albumFixtures.withItems;

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
  return { read, answerNext, now: () => answer };
}

function withLevelItems(level: number): Album {
  const board = withItems.board!;
  const levelItems = [1, 2, 3].map((slot) => ({ item: `level-${level}-${slot}` as BoardItem["item"], earnedAt: board.items[0]!.earnedAt + slot, reason: { kind: "levelUp" as const, level } }));
  return { ...withItems, board: { ...board, items: [...board.items, ...levelItems] } };
}

function withoutTheItem(album: Album, item: string): Album {
  const board = album.board!;
  return { ...album, board: { ...board, items: board.items.filter((waiting) => waiting.item !== item) }, level: { ...album.level, xp: album.level.xp + 15 } };
}

function visit(album: Album, { turnItem = async (item: string) => fixtureTurnOf(item), path = "/book#me", levelUp }: { turnItem?: (item: string) => Promise<TurnReply>; path?: string; levelUp?: LevelUpRead } = {}) {
  window.history.replaceState(null, "", path);
  const live = anAlbumThatAnswers(album);
  const turned = vi.fn(async (item: string) => {
    const reply = await turnItem(item);
    if (reply.kind === "turned") live.answerNext(withoutTheItem(live.now(), item));
    return reply;
  });
  const view = renderAlbum(memberWithTheAlbum, live.read, { hoggies: fixedHoggies(hoggiesFixtures.midway), levelUp, commands: { turnItem: turned } });
  return { ...view, turnItem: turned };
}

async function theBoard() {
  return within(await screen.findByRole("dialog", { name: "Your items" }));
}

async function topBar() {
  const [bar] = await screen.findAllByRole("banner");
  return within(bar!);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

describe("The item board", () => {
  it("opens over the album with every waiting item face down and the same, and no packs or tray", async () => {
    visit(withItems);
    const board = await theBoard();
    expect(board.getByRole("heading", { name: "3 items wait" })).toBeVisible();
    const items = board.getAllByRole("button", { name: "A face-down item. Turn it over" });
    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.textContent))).toEqual(new Set(["?"]));
    expect(screen.getByRole("dialog", { name: "Your items" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("navigation", { name: "Album", hidden: true }).closest("[inert]")).not.toBeNull();
    const bar = await topBar();
    expect(bar.queryByRole("button", { name: /packs/i, hidden: true })).toBeNull();
    expect(bar.queryByRole("button", { name: /^Tray/, hidden: true })).toBeNull();
  });

  it("names nothing about what waits, only how many", async () => {
    visit(withItems);
    const board = await theBoard();
    const dialog = screen.getByRole("dialog", { name: "Your items" });
    expect(dialog).toHaveTextContent(/^3 items wait\?\?\?Later$/);
    expect(board.queryByRole("img")).toBeNull();
  });

  it("counts a board that holds more as more", async () => {
    visit({ ...withItems, board: { ...withItems.board!, more: true } });
    expect((await theBoard()).getByRole("heading", { name: "3+ items wait" })).toBeVisible();
  });

  it("closes on Later and opens again from the items-wait pill", async () => {
    const { user } = visit(withItems);
    await user.click((await theBoard()).getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "3 items wait" }));
    expect((await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" })).toHaveLength(3);
  });

  it("LP20: shows the pointer that taps the first item once a visit, so after a hover it stays gone when the board opens again", async () => {
    const { user } = visit(withItems);
    const board = await theBoard();
    expect(document.querySelector(".ib-pointer")).not.toBeNull();
    await user.hover(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
    await user.click(board.getByRole("button", { name: "Later" }));

    await user.click(screen.getByRole("button", { name: "3 items wait" }));

    await theBoard();
    expect(document.querySelector(".ib-pointer")).toBeNull();
  });

  it("turns the clicked item once and, under reduced motion, lands its hoggie on the Hoggies page at once, saying what it was and the XP", async () => {
    preferReducedMotion();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const answer = deferred<TurnReply>();
    const { user, turnItem } = visit(withItems, { turnItem: () => answer.promise });
    const [first] = (await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" });
    await user.click(first!);
    await user.click(first!);
    expect(turnItem).toHaveBeenCalledTimes(1);
    expect(turnItem).toHaveBeenCalledWith(withItems.board!.items[0]!.item);
    answer.resolve(fixtureTurnOf(withItems.board!.items[0]!.item));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull());
    expect(await screen.findByRole("heading", { level: 1, name: "Hoggies" })).toBeVisible();
    expect(window.location.hash).toBe("#hoggies");
    const said = screen.getByRole("status", { name: "Turned over" });
    expect(said).toHaveTextContent("70's Dance: Rare hoggie · New");
    expect(said).toHaveTextContent("+15 XP");
    const plate = await waitFor(() => {
      const landed = document.querySelector<HTMLElement>('[data-hoggie="70s-dance"]');
      expect(landed).toHaveAttribute("data-landed");
      return landed!;
    });
    expect(scrolled.mock.contexts).toContain(plate);
    expect(screen.getByRole("button", { name: "2 items wait" })).toBeVisible();
  });

  it("LP14: under reduced motion, a hoggie whose turn unlocked the thanked person's hype emoji shows it beside the landed hoggie", async () => {
    preferReducedMotion();
    const [first] = withItems.board!.items;
    const turned = fixtureTurnOf(first!.item);
    const hype = { name: "bram-teller-hype", picture: "/emoji/hype-bram.png", inSlack: false, from: "Bram Teller" };
    const { user } = visit(withItems, { turnItem: async () => (turned.kind === "turned" ? { ...turned, unlocked: { ...turned.unlocked, hype } } : turned) });

    await user.click((await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);

    const plate = await waitFor(() => {
      const landed = document.querySelector<HTMLElement>('[data-hoggie="70s-dance"]');
      expect(landed).toHaveAttribute("data-landed");
      return landed!;
    });
    expect(within(plate).getByRole("img", { name: ":bram-teller-hype: hype emoji unlocked" }), "the hype emoji beside the landed hoggie").toBeInTheDocument();
  });

  it("takes what turned over away once the member moves to another page", async () => {
    preferReducedMotion();
    const { user } = visit(withItems);
    await user.click((await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Hoggies" });
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("70's Dance: Rare hoggie · New");

    await user.click(within(screen.getByRole("navigation", { name: "Album" })).getByRole("link", { name: /Milestones/ }));

    await screen.findByRole("heading", { level: 1, name: "Milestones" });
    expect(screen.getByRole("status", { name: "Turned over" })).toBeEmptyDOMElement();
  });

  it("lands the hoggie in view even when the Hoggies page was filtered to hoggies that leave it out", async () => {
    const dance = hoggiesFixtures.midway.hoggies.find(({ hoggie }) => hoggie === "70s-dance")!;
    const { user } = visit(withItems, { path: "/book#hoggies" });
    await user.click((await theBoard()).getByRole("button", { name: "Later" }));
    await user.click(screen.getByRole("button", { name: dance.found ? /^Still hidden/ : /^Found/ }));
    expect(document.querySelector('[data-hoggie="70s-dance"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "3 items wait" }));
    await user.click((await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);

    await waitFor(() => expect(document.querySelector('[data-hoggie="70s-dance"]')).toHaveAttribute("data-landed"));
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the board and says so when the turn is refused", async () => {
    const { user, turnItem } = visit(withItems, { turnItem: async () => ({ kind: "refused" }) });
    const board = await theBoard();
    await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[1]!);
    expect(turnItem).toHaveBeenCalledWith(withItems.board!.items[1]!.item);
    expect(await board.findByRole("alert")).toHaveTextContent("That item couldn't be turned over. Try again.");
    expect(board.getAllByRole("button", { name: "A face-down item. Turn it over" })).toHaveLength(3);
  });

  it("tags each level-up item with its level beside a back that is the same as every other back", async () => {
    visit(withLevelItems(3));
    const board = await theBoard();
    const levelItems = board.getAllByRole("button", { name: "A face-down item from level 3. Turn it over" });
    expect(levelItems).toHaveLength(3);
    for (const item of levelItems) expect(within(item).getByText("Level 3")).toBeVisible();
    const thanksItems = board.getAllByRole("button", { name: "A face-down item. Turn it over" });
    for (const item of thanksItems) expect(within(item).queryByText(/^Level/)).toBeNull();
    const backs = [...levelItems, ...thanksItems].map((item) => item.querySelector(".ib-back")!.outerHTML);
    expect(new Set(backs).size, "distinct backs").toBe(1);
  });

  it("waits while the level-up page plays", async () => {
    visit(withItems, { path: "/book#level-up/7", levelUp: fixedLevelUp(levelUpFixtures.levelSeven) });
    await screen.findByRole("navigation", { name: "Album" });
    expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull();
    expect(screen.queryByRole("button", { name: "3 items wait" })).toBeNull();
  });

  it("LP25: opens the album with the board from an old level-up link, whose reveal the item board turned off", async () => {
    visit(withItems, { path: "/book#level-up/7", levelUp: fixedLevelUp({ kind: "off" }) });

    expect((await theBoard()).getAllByRole("button", { name: "A face-down item. Turn it over" })).toHaveLength(3);
    expect(window.location.hash).toBe("#me");
    expect(screen.queryByText("Nothing to reveal")).toBeNull();
  });
});

describe("With the item board off", () => {
  it("keeps the packs button and the tray as they were", async () => {
    window.history.replaceState(null, "", "/book#me");
    renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway));
    const bar = await topBar();
    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toBeVisible();
    expect(bar.getByRole("button", { name: "Tray, nothing to put in" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull();
  });
});
