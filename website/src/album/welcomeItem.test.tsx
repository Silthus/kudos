import { act, fireEvent, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BoardItem, LoopLesson } from "../../../convex/website/album";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const welcomeItem: BoardItem = { item: "item-welcome" as Id<"items">, earnedAt: 0, reason: { kind: "welcome" } };
const thanksItem = albumFixtures.withItems.board!.items[0]!;
const tacoLesson: LoopLesson = { kudosEmoji: "taco", kudosEmojiImage: null };
const itemBoardCss = readFileSync(join(__dirname, "itemBoard.css"), "utf8");

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
  const without = (item: string) => {
    const board = answer.board!;
    answer = { ...answer, board: { ...board, items: board.items.filter((waiting) => waiting.item !== item) } };
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, without };
}

function welcomeTurnTeaching(teaches: LoopLesson): TurnReply {
  const turned = fixtureTurnOf(thanksItem.item);
  return turned.kind === "turned" ? { ...turned, applied: null, teaches } : turned;
}

function visit(items: BoardItem[], teaches: LoopLesson = tacoLesson) {
  window.history.replaceState(null, "", "/book#me");
  const live = anAlbumThatAnswers({ ...albumFixtures.withItems, board: { items, more: false } });
  const turnItem = async (item: string) => {
    const reply = item === welcomeItem.item ? welcomeTurnTeaching(teaches) : fixtureTurnOf(item);
    live.without(item);
    return reply;
  };
  return renderAlbum(shellFixtures.member, live.read, { hoggies: fixedHoggies(hoggiesFixtures.midway), commands: { turnItem } });
}

async function turnTheFirstItem(user: ReturnType<typeof visit>["user"]) {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }));
  await user.click(board.getAllByRole("button", { name: "An unidentified item. Identify it" })[0]!);
  await screen.findByRole("heading", { level: 1, name: "Hoggies" });
}

function theLesson() {
  return screen.queryByRole("note", { name: "How the next item comes" });
}

describe("LP49: after the welcome item turns, one line teaches the loop", () => {
  beforeEach(() => {
    preferReducedMotion();
  });

  it("shows the line with the workspace's kudos emoji once the welcome item has turned", async () => {
    const { user } = visit([welcomeItem]);
    expect(theLesson()).toBeNull();

    await turnTheFirstItem(user);

    expect(theLesson()).toHaveTextContent("Your next item comes when you thank a teammate with 🌮 in a message.");
  });

  it("shows a custom kudos emoji as its picture", async () => {
    const { user } = visit([welcomeItem], { kudosEmoji: "hoggo", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hoggo/1.png" });

    await turnTheFirstItem(user);

    expect(within(theLesson()!).getByRole("img", { name: ":hoggo:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/hoggo/1.png");
  });

  it("keeps the line clear of the top of the page: it sits at the foot of the window, apart from what turned over under the top bar", async () => {
    const { user } = visit([welcomeItem]);

    await turnTheFirstItem(user);

    expect(theLesson()!.closest(".ib-strip"), "the line under the top bar, over the page's own header").toBeNull();
    expect(theLesson()!.closest(".ib-after")).not.toBeNull();
    expect(itemBoardCss).toMatch(/\.ib-after \{\s*position: fixed;\s*bottom: /);
  });

  it("leaves room at the foot of the page while the line shows there, so it never covers the page's last lines", async () => {
    const { user } = visit([welcomeItem]);

    await turnTheFirstItem(user);

    expect(theLesson()!.closest(".ib-after")!.parentElement).toHaveClass("al-shell");
    expect(itemBoardCss, "the room is the strip's tallest").toMatch(/\.al-shell:has\(> \.ib-after:not\(:empty\)\) \.al-main \{\s*padding-bottom: calc\(var\(--ib-after-most\) \+ /);
    expect(itemBoardCss, "however many wins pile up, the strip stops at its tallest and scrolls").toMatch(/\.ib-after \{[^}]*max-height: var\(--ib-after-most\);\s*overflow-y: auto;/);
  });

  it("shows only once: the next item's turn takes the line away, and a thanks item's turn never shows it", async () => {
    const { user } = visit([welcomeItem, thanksItem]);
    await turnTheFirstItem(user);
    expect(theLesson()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "1 unidentified item waits" }));
    await turnTheFirstItem(user);

    expect(theLesson()).toBeNull();
  });
});

function theFaceDownItemsNow() {
  return within(screen.getByRole("dialog", { name: "Your items" })).getAllByRole("button", { name: "An unidentified item. Identify it" });
}

async function turnOnFakeTime(item: HTMLElement) {
  vi.useFakeTimers();
  const due = Date.now() + 6_000;
  await act(async () => fireEvent.click(item));
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(16));
}

describe("LP49: with full motion and another item still waiting, the board that comes back teaches the loop", { timeout: 30_000 }, () => {
  it("shows the line on the board once the welcome item has landed, and the next item's turn takes it away", async () => {
    visit([welcomeItem, thanksItem]);
    await screen.findByRole("dialog", { name: "Your items" });

    await turnOnFakeTime(theFaceDownItemsNow()[0]!);
    expect(within(screen.getByRole("dialog", { name: "Your items" })).getByRole("note", { name: "How the next item comes" })).toHaveTextContent("Your next item comes when you thank a teammate with 🌮 in a message.");

    await turnOnFakeTime(theFaceDownItemsNow()[0]!);
    expect(theLesson()).toBeNull();
  });
});
