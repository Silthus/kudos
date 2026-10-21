import { act, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BoardItem, LoopLesson } from "../../../convex/website/album";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const welcomeItem: BoardItem = { item: "item-welcome" as Id<"items">, earnedAt: 0, reason: { kind: "welcome" } };
const thanksItem = albumFixtures.withItems.board!.items[0]!;
const tacoLesson: LoopLesson = { kudosEmoji: "taco", kudosEmojiImage: null };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
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
  await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
  await screen.findByRole("heading", { level: 1, name: "Hoggies" });
}

function theLesson() {
  return screen.queryByRole("note", { name: "How the next item comes" });
}

describe("LP49: after the welcome item turns, one line teaches the loop", () => {
  it("shows the line with the workspace's kudos emoji once the welcome item has turned", async () => {
    const { user } = visit([welcomeItem]);
    expect(theLesson()).toBeNull();

    await turnTheFirstItem(user);

    expect(theLesson()).toHaveTextContent("Your next item comes when you thank a teammate with 🌮 and say why.");
  });

  it("shows a custom kudos emoji as its picture", async () => {
    const { user } = visit([welcomeItem], { kudosEmoji: "hoggo", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hoggo/1.png" });

    await turnTheFirstItem(user);

    expect(within(theLesson()!).getByRole("img", { name: ":hoggo:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/hoggo/1.png");
  });

  it("shows only once: the next item's turn takes the line away, and a thanks item's turn never shows it", async () => {
    const { user } = visit([welcomeItem, thanksItem]);
    await turnTheFirstItem(user);
    expect(theLesson()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "1 item waits" }));
    await turnTheFirstItem(user);

    expect(theLesson()).toBeNull();
  });
});
