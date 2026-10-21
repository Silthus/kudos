import { act, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberId } from "../../../convex/workspace/directory";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedPeople } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";

const withItems = albumFixtures.withItems;

const unlockedAt = Date.parse("2026-10-20T10:00:00Z");

const nothingUnlocked = { teamStickers: [], hype: null, milestones: [] };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function aStickerTurnOf(person: string, page: { kind: "team"; team: string } | { kind: "person"; person: MemberId }, unlocked: Extract<TurnReply, { kind: "turned" }>["unlocked"] = nothingUnlocked): TurnReply {
  const thanked = withItems.people.find((someone) => someone.person === person)!;
  return { kind: "turned", face: { kind: "sticker", person: person as MemberId, isNew: true, thanked: { name: thanked.name, face: thanked.face } }, applied: null, page, unlocked, again: false };
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
  const answerNext = (next: Album) => {
    answer = next;
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answerNext, now: () => answer };
}

function withTheStickerIn(album: Album, item: string, person: string): Album {
  return { ...album, board: { ...album.board!, items: album.board!.items.filter((waiting) => waiting.item !== item) }, people: album.people.map((someone) => (someone.person === person ? { ...someone, held: true } : someone)) };
}

function visit(reply: TurnReply, person: string) {
  window.history.replaceState(null, "", "/book#me");
  const live = anAlbumThatAnswers(withItems);
  const turnItem = vi.fn(async (item: string) => {
    live.answerNext(withTheStickerIn(live.now(), item, person));
    return reply;
  });
  return renderAlbum(shellFixtures.member, live.read, { people: fixedPeople(withItems), commands: { turnItem } });
}

async function turnTheFirstItem(user: ReturnType<typeof visit>["user"]) {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }));
  await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Your items" })).toBeNull());
}

function landedSticker() {
  return waitFor(() => {
    const landed = document.querySelector<HTMLElement>("[data-landed]");
    expect(landed).not.toBeNull();
    return landed!;
  });
}

describe("LP13 LP19: a turned sticker lands on its page, plain path", () => {
  it("goes to the person's team page, scrolls the landed sticker into view at once and marks it, names the person and shows their hype emoji beside the sticker", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const hype = { name: "dov-esker-hype", picture: "/emoji/hype-dov.png", inSlack: false };
    const { user } = visit(aStickerTurnOf("dov-esker", { kind: "team", team: "copper-kite" }, { ...nothingUnlocked, hype }), "dov-esker");

    await turnTheFirstItem(user);

    expect(await screen.findByRole("heading", { level: 1, name: "Copper Kite" })).toBeVisible();
    expect(window.location.hash).toBe("#teams/copper-kite");
    const landed = await landedSticker();
    expect(landed).toHaveTextContent("Dov Esker");
    expect(scrolled.mock.contexts).toContain(landed);
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }));
    expect(within(landed).getByRole("img", { name: ":dov-esker-hype: hype emoji unlocked" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("Dov Esker: Sticker · New");
    expect(screen.getByRole("button", { name: "2 items wait" })).toBeVisible();
  });

  it("shows the team sticker the sticker filled unlocked on that page, with its date, its emoji and New, and says so", async () => {
    const sticker = { team: "tin-orchard", name: "Tin Orchard", art: { kind: "crest" as const, slug: "replay" }, emoji: "team-tin-orchard", at: unlockedAt };
    const { user } = visit(aStickerTurnOf("cass-vey", { kind: "team", team: "tin-orchard" }, { ...nothingUnlocked, teamStickers: [sticker] }), "cass-vey");

    await turnTheFirstItem(user);

    expect(await screen.findByRole("heading", { level: 1, name: "Tin Orchard" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Tin Orchard sticker, unlocked" })).toBeVisible();
    const tag = screen.getByText(/^Unlocked /).closest("p")!;
    expect(tag).toHaveTextContent("Unlocked 20 Oct");
    expect(tag).toHaveTextContent(":team-tin-orchard:");
    expect(tag).toHaveTextContent("New");
    expect(screen.queryByRole("button", { name: /Ready to unlock/ })).toBeNull();
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("Cass Vey: Sticker · New · Tin Orchard team sticker unlocked");
  });

  it("goes to the person's own page when they are on no team page, and marks the sticker there", async () => {
    const { user } = visit(aStickerTurnOf("dov-esker", { kind: "person", person: "dov-esker" as MemberId }), "dov-esker");

    await turnTheFirstItem(user);

    expect(window.location.hash).toBe("#people/dov-esker");
    expect(await landedSticker()).toBeVisible();
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("Dov Esker: Sticker · New");
  });
});
