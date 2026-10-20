import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { Album, LevelUpRead, LevelUpShown } from "./answer";
import { fixedLevelUp, levelUpFixtures } from "./levelUpFixtures";

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

const withLevelFiveUnseen: Album = { ...albumFixtures.midway, emojis: albumFixtures.midway.emojis.map((emoji) => (emoji.id === "level:5" ? { ...emoji, seen: false } : emoji)) };

function visit(level: number, levelUp: LevelUpRead = fixedLevelUp(levelUpFixtures.levelSeven), album: Album = albumFixtures.midway) {
  window.history.replaceState(null, "", `/book#level-up/${level}`);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { levelUp });
}

async function theReveal() {
  await screen.findByRole("navigation", { name: "Album" });
  return within(await screen.findByRole("main"));
}

function faceUp(name: string) {
  return screen.getByRole("group", { name });
}

describe("the level-up reveal plays where the DM's link lands", () => {
  it("a big Level 7 burst comes in first and takes focus, saying the hoggies came from this level up", async () => {
    visit(7);
    const reveal = await theReveal();

    const title = await reveal.findByRole("heading", { level: 1, name: "Level 7" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(reveal.getByText("Reaching level 7 brought you three hoggies")).toBeInTheDocument();
    expect(reveal.getByTestId("confetti")).toBeInTheDocument();
    expect(reveal.getAllByRole("group", { name: /hoggie card, face down$/ })).toHaveLength(3);
  });

  it("right after the burst, the three cards turn face up one after another, each with its name and rarity", async () => {
    visit(7);
    const reveal = await theReveal();

    const first = await reveal.findByRole("group", { name: "Banana, Common" }, { timeout: 3_000 });
    expect(first).toHaveAttribute("data-face-up", "");
    expect(reveal.getByRole("group", { name: "The third hoggie card, face down" })).not.toHaveAttribute("data-face-up");

    expect(await reveal.findByRole("group", { name: "Rocket, Legendary" }, { timeout: 4_000 })).toHaveAttribute("data-face-up", "");
    expect(faceUp("Cake, Uncommon")).toHaveAttribute("data-face-up", "");
    expect(within(faceUp("Banana, Common")).getByText("New in your album")).toBeInTheDocument();
    expect(within(faceUp("Cake, Uncommon")).queryByText("New in your album")).not.toBeInTheDocument();
  }, 10_000);

  it("the third card's rarity sparkles once it turns", async () => {
    const { user } = visit(7);
    const reveal = await theReveal();

    await user.click(await reveal.findByRole("button", { name: "Show them all" }));

    expect(within(faceUp("Rocket, Legendary")).getByTestId("sparkles")).toBeInTheDocument();
    expect(within(faceUp("Banana, Common")).queryByTestId("sparkles")).not.toBeInTheDocument();
  });

  it("Show them all turns every card at once and says what the level up brought", async () => {
    const { user } = visit(7);
    const reveal = await theReveal();

    await user.click(await reveal.findByRole("button", { name: "Show them all" }));

    for (const name of ["Banana, Common", "Cake, Uncommon", "Rocket, Legendary"]) expect(faceUp(name)).toHaveAttribute("data-face-up", "");
    expect(reveal.queryByRole("button", { name: "Show them all" })).not.toBeInTheDocument();
    expect(reveal.getByRole("status")).toHaveTextContent("Level 7 brought you Banana, Common, new, Cake, Uncommon, a spare, and Rocket, Legendary, new.");
  });

  it("ends with a way on to the member's hoggies", async () => {
    visit(7);
    const reveal = await theReveal();

    expect(await reveal.findByRole("link", { name: "See all your hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("the emojis the level up earned show below the cards, and the emoji moment never pops them on top", async () => {
    const { user, actions } = visit(5, fixedLevelUp(levelUpFixtures.levelFive), withLevelFiveUnseen);
    const reveal = await theReveal();
    await user.click(await reveal.findByRole("button", { name: "Show them all" }));

    const earned = reveal.getByRole("list", { name: "New emojis from this level up" });
    expect(within(earned).getByText(":level-5:")).toBeInTheDocument();
    await waitFor(() => expect(actions.markEmojisSeen).toHaveBeenCalledWith(["level:5"]));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument();
  });

  it("a level up with no new emoji lists none", async () => {
    const { user } = visit(7);
    const reveal = await theReveal();
    await user.click(await reveal.findByRole("button", { name: "Show them all" }));

    expect(reveal.queryByRole("list", { name: "New emojis from this level up" })).not.toBeInTheDocument();
  });

  it("with reduced motion, every card is face up at once, with no confetti, sparkles, ring or shine", async () => {
    preferReducedMotion();
    visit(7);
    const reveal = await theReveal();

    expect(await reveal.findByRole("group", { name: "Rocket, Legendary" })).toHaveAttribute("data-face-up", "");
    expect(faceUp("Banana, Common")).toHaveAttribute("data-face-up", "");
    for (const flourish of ["confetti", "sparkles", "ring", "shine"]) expect(reveal.queryByTestId(flourish)).not.toBeInTheDocument();
    expect(reveal.queryByRole("button", { name: "Show them all" })).not.toBeInTheDocument();
  });

  it.each<[string, LevelUpShown, string]>([
    ["off", { kind: "off" }, "Level-up reveals aren't open to you yet."],
    ["none", { kind: "none" }, "There's no level up to reveal here."],
  ])("an %s answer shows a short line and the way on", async (_, answer, line) => {
    visit(4, fixedLevelUp(answer));
    const reveal = await theReveal();

    expect(await reveal.findByText(line)).toBeInTheDocument();
    expect(reveal.getByRole("link", { name: "See all your hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("asks getLevelUp for the page's level there and for nothing elsewhere in the album", async () => {
    const read = vi.fn(fixedLevelUp(levelUpFixtures.levelSeven));
    const { user } = visit(7, read);
    await theReveal();
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
