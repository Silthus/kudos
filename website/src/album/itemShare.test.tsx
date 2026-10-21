import { act, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { shellFixtures, type ShareReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const [win, other] = albumFixtures.withItems.board!.items;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  preferReducedMotion();
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
  const board = within(await screen.findByRole("dialog", { name: "Your items" }));
  await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
  await screen.findByRole("heading", { level: 1, name: "Hoggies" });
}

function theShareButton() {
  return screen.queryByRole("button", { name: "Share" });
}

describe("LP51 LP52: Share shows after a turn the album offers it for, and is gone after the press", () => {
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
});
