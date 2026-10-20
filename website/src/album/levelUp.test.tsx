import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { Album, AlbumLevelUp, LevelUpRead, LevelUpShown } from "./answer";
import { emojiMomentTiming } from "./EmojiMoment";
import { levelUpTiming } from "./LevelUp";
import { fixedLevelUp, levelUpFixtures } from "./levelUpFixtures";

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
});

const withLevelFiveUnseen: Album = { ...albumFixtures.midway, emojis: albumFixtures.midway.emojis.map((emoji) => (emoji.id === "level:5" ? { ...emoji, seen: false } : emoji)) };

const { burstMs, turnMs } = levelUpTiming;

function visit(level: number, levelUp: LevelUpRead, album: Album = albumFixtures.midway) {
  window.history.replaceState(null, "", `/book#level-up/${level}`);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { levelUp });
}

function aLevelUpAnsweredLater() {
  let answer: LevelUpShown | undefined;
  const listeners = new Set<() => void>();
  const read: LevelUpRead = (level) => {
    const shown = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => answer,
    );
    return level === null ? undefined : shown;
  };
  const answerWith = (next: LevelUpShown) => {
    answer = next;
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answerWith };
}

async function revealOnFakeTime(levelUp: AlbumLevelUp, album: Album = albumFixtures.midway) {
  const later = aLevelUpAnsweredLater();
  const view = visit(levelUp.level, later.read, album);
  await screen.findByRole("navigation", { name: "Album" });
  vi.useFakeTimers();
  later.answerWith(levelUp);
  return { ...view, reveal: within(screen.getByRole("main")) };
}

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}

async function theWholeReveal() {
  await advance(burstMs);
  await advance(turnMs);
  await advance(turnMs);
}

function card(name: string) {
  return screen.getByRole("group", { name });
}

function acknowledgedLevelFive(markEmojisSeen: ReturnType<typeof vi.fn>) {
  return markEmojisSeen.mock.calls.filter(([ids]) => (ids as string[]).includes("level:5")).length;
}

describe("the level-up reveal plays where the DM's link lands", () => {
  it("a big Level 7 burst comes in first and takes focus, saying the hoggies came from this level up, over three cards face down", async () => {
    const { reveal } = await revealOnFakeTime(levelUpFixtures.levelSeven);

    const title = reveal.getByRole("heading", { level: 1, name: "Level 7" });
    expect(title).toHaveFocus();
    expect(reveal.getByText("Reaching level 7 brought you three hoggies")).toBeInTheDocument();
    expect(reveal.getByTestId("confetti")).toBeInTheDocument();
    expect(reveal.getAllByRole("group", { name: /hoggie card, face down$/ })).toHaveLength(3);
  });

  it("right after the burst, the three cards turn face up one after another, each with its name and rarity", async () => {
    const { reveal } = await revealOnFakeTime(levelUpFixtures.levelSeven);

    await advance(burstMs - 1);
    expect(reveal.getAllByRole("group", { name: /face down$/ })).toHaveLength(3);

    await advance(1);
    expect(card("Banana, Common")).toHaveAttribute("data-face-up", "");
    expect(card("The second hoggie card, face down")).not.toHaveAttribute("data-face-up");

    await advance(turnMs);
    expect(card("Cake, Uncommon")).toHaveAttribute("data-face-up", "");
    expect(card("The third hoggie card, face down")).not.toHaveAttribute("data-face-up");

    await advance(turnMs);
    expect(card("Rocket, Legendary")).toHaveAttribute("data-face-up", "");
    expect(within(card("Banana, Common")).getByText("New in your album")).toBeInTheDocument();
    expect(within(card("Cake, Uncommon")).queryByText("New in your album")).not.toBeInTheDocument();
    expect(reveal.getByRole("status")).toHaveTextContent("Level 7 brought you Banana, Common, new, Cake, Uncommon, a spare, and Rocket, Legendary, new.");
  });

  it("the third card's rarity sparkles once it turns", async () => {
    await revealOnFakeTime(levelUpFixtures.levelSeven);

    await theWholeReveal();

    expect(within(card("Rocket, Legendary")).getByTestId("sparkles")).toBeInTheDocument();
    expect(within(card("Banana, Common")).queryByTestId("sparkles")).not.toBeInTheDocument();
  });

  it("Show them all turns every card at once", async () => {
    const { reveal } = await revealOnFakeTime(levelUpFixtures.levelSeven);

    await act(async () => fireEvent.click(reveal.getByRole("button", { name: "Show them all" })));

    for (const name of ["Banana, Common", "Cake, Uncommon", "Rocket, Legendary"]) expect(card(name)).toHaveAttribute("data-face-up", "");
    expect(reveal.queryByRole("button", { name: "Show them all" })).not.toBeInTheDocument();
  });

  it("ends with a way on to the member's hoggies", async () => {
    const { reveal } = await revealOnFakeTime(levelUpFixtures.levelSeven);

    await theWholeReveal();

    expect(reveal.getByRole("link", { name: "See all your hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("the emojis the level up earned show below the cards once they all turned, acknowledged as seen exactly then and once, and the emoji moment never pops them on top", async () => {
    const { reveal, actions } = await revealOnFakeTime(levelUpFixtures.levelFive, withLevelFiveUnseen);

    await advance(burstMs);
    await advance(turnMs);
    expect(reveal.queryByRole("list", { name: "New emojis from this level up" })).not.toBeInTheDocument();
    expect(acknowledgedLevelFive(actions.markEmojisSeen)).toBe(0);

    await advance(turnMs);
    expect(within(reveal.getByRole("list", { name: "New emojis from this level up" })).getByText(":level-5:")).toBeInTheDocument();
    expect(acknowledgedLevelFive(actions.markEmojisSeen)).toBe(1);

    await advance(emojiMomentTiming.settleMs * 2);
    expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument();
    expect(acknowledgedLevelFive(actions.markEmojisSeen)).toBe(1);
  });

  it("a member who leaves while the cards still turn never has the emoji acknowledged, and its own moment pops instead", async () => {
    const { actions } = await revealOnFakeTime(levelUpFixtures.levelFive, withLevelFiveUnseen);
    await advance(burstMs);

    await act(async () => fireEvent.click(within(screen.getByRole("navigation", { name: "Album" })).getByRole("link", { name: /^Milestones/ })));
    await advance(emojiMomentTiming.settleMs);

    expect(acknowledgedLevelFive(actions.markEmojisSeen)).toBe(0);
    expect(screen.getByRole("dialog", { name: "New emoji unlocked" })).toBeInTheDocument();
  });

  it("a level up with no new emoji lists none", async () => {
    const { reveal } = await revealOnFakeTime(levelUpFixtures.levelSeven);

    await theWholeReveal();

    expect(reveal.queryByRole("list", { name: "New emojis from this level up" })).not.toBeInTheDocument();
  });

  it("with reduced motion, every card is face up at once, with no confetti, sparkles, ring or shine, and the emojis acknowledged once", async () => {
    preferReducedMotion();
    const { reveal, actions } = await revealOnFakeTime(levelUpFixtures.levelFive, withLevelFiveUnseen);

    expect(card("Angel, Epic")).toHaveAttribute("data-face-up", "");
    expect(card("Asleep, Common")).toHaveAttribute("data-face-up", "");
    for (const flourish of ["confetti", "sparkles", "ring", "shine"]) expect(reveal.queryByTestId(flourish)).not.toBeInTheDocument();
    expect(reveal.queryByRole("button", { name: "Show them all" })).not.toBeInTheDocument();
    expect(acknowledgedLevelFive(actions.markEmojisSeen)).toBe(1);
  });

  it.each<[string, LevelUpShown, string]>([
    ["off", { kind: "off" }, "Level-up reveals aren't open to you yet."],
    ["none", { kind: "none" }, "There's no level up to reveal here."],
  ])("an %s answer shows a short line and the way on", async (_, answer, line) => {
    visit(4, fixedLevelUp(answer));
    await screen.findByRole("navigation", { name: "Album" });
    const reveal = within(screen.getByRole("main"));

    expect(await reveal.findByText(line)).toBeInTheDocument();
    expect(reveal.getByRole("link", { name: "See all your hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("asks getLevelUp for the page's level there and for nothing elsewhere in the album", async () => {
    const read = vi.fn(fixedLevelUp(levelUpFixtures.levelSeven));
    const { user } = visit(7, read);
    await screen.findByRole("navigation", { name: "Album" });
    expect(read).toHaveBeenLastCalledWith(7);

    await user.click(within(screen.getByRole("navigation", { name: "Album" })).getByRole("link", { name: "Hoggies" }));

    await waitFor(() => expect(read).toHaveBeenLastCalledWith(null));
  });

  it("waits for the read without showing an empty reveal", async () => {
    visit(7, () => undefined);
    await screen.findByRole("navigation", { name: "Album" });

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading", { name: "Level 7" })).not.toBeInTheDocument();
  });
});
