import { act, fireEvent, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BoardItem, LoopLesson } from "../../../convex/website/album";
import type { HowItWorksCard } from "../../../convex/website/onboarding";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumRead } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const welcomeItem: BoardItem = { item: "item-welcome" as Id<"items">, earnedAt: 0, reason: { kind: "welcome" } };
const thanksItem = albumFixtures.withItems.board!.items[0]!;
const taco: LoopLesson = { kudosEmoji: "taco", kudosEmojiImage: null };
const slack = "https://app.slack.com/client/T1";
const newcomersCard: HowItWorksCard = { slack, toLevelTwo: true, kudos: taco };
const howItWorksCss = readFileSync(join(__dirname, "howItWorks.css"), "utf8");

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

function welcomeTurnTeaching(): TurnReply {
  const turned = fixtureTurnOf(thanksItem.item);
  return turned.kind === "turned" ? { ...turned, applied: null, teaches: taco } : turned;
}

function visit(items: BoardItem[], card: HowItWorksCard | null = newcomersCard) {
  window.history.replaceState(null, "", "/book#me");
  const live = anAlbumThatAnswers({ ...albumFixtures.withItems, board: { items, more: false }, ...(card !== null && { howItWorks: card }) });
  const turnItem = async (item: string) => {
    const reply = item === welcomeItem.item ? welcomeTurnTeaching() : fixtureTurnOf(item);
    live.answers((album) => ({ ...album, board: { ...album.board!, items: album.board!.items.filter((waiting) => waiting.item !== item) } }));
    return reply;
  };
  const view = renderAlbum(shellFixtures.member, live.read, { hoggies: fixedHoggies(hoggiesFixtures.midway), commands: { turnItem } });
  const closedOnTheServer = () => live.answers(({ howItWorks: _, ...album }) => album);
  return { ...view, closedOnTheServer };
}

function theCard() {
  return screen.queryByRole("dialog", { name: "How HedgeHug works" });
}

function theItemBoard() {
  return screen.queryByRole("dialog", { name: "Your items" });
}

function theLesson() {
  return screen.queryByRole("note", { name: "How the next item comes" });
}

async function turnTheFirstItem(user: ReturnType<typeof visit>["user"]) {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }));
  await user.click(board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);
  await screen.findByRole("heading", { level: 1, name: "Hoggies" });
}

async function turnOnFakeTime(item: HTMLElement) {
  vi.useFakeTimers();
  const due = Date.now() + 6_000;
  await act(async () => fireEvent.click(item));
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(16));
}

describe("LP67: the how-it-works card opens once, at the end of the arrival's sequence", () => {
  beforeEach(() => {
    preferReducedMotion();
  });

  it("with the welcome item waiting at arrival, opens after its turn has landed, in place of the line that teaches the loop", async () => {
    const { user } = visit([welcomeItem]);
    await screen.findByRole("dialog", { name: "Your items" });
    expect(theCard(), "before the welcome item turns").toBeNull();

    await turnTheFirstItem(user);

    expect(theCard()).toBeInTheDocument();
    expect(theLesson(), "the line the card replaces").toBeNull();
  });

  it("shows no card while the welcome item is left face down", async () => {
    const { user } = visit([welcomeItem]);
    await user.click(within(await screen.findByRole("dialog", { name: "Your items" })).getByRole("button", { name: "Later" }));

    expect(theCard()).toBeNull();
  });

  it("without a welcome item and with no XP moment, opens at arrival, and the waiting items land once it closes", async () => {
    const { user } = visit([thanksItem]);

    await screen.findByRole("dialog", { name: "How HedgeHug works" });
    expect(theItemBoard(), "the items wait for the card").toBeNull();

    await user.click(screen.getByRole("button", { name: "Got it" }));

    expect(theCard()).toBeNull();
    expect(await screen.findByRole("dialog", { name: "Your items" })).toBeInTheDocument();
  });

  it("without a welcome item and nothing waiting, still opens at arrival", async () => {
    visit([]);

    expect(await screen.findByRole("dialog", { name: "How HedgeHug works" })).toBeInTheDocument();
  });

  it("never opens again in the visit once closed, even while the album still answers it", async () => {
    const { user } = visit([welcomeItem, thanksItem]);
    await turnTheFirstItem(user);
    await user.click(within(theCard()!).getByRole("button", { name: "Got it" }));

    await user.click(screen.getByRole("button", { name: "1 item waits" }));
    await turnTheFirstItem(user);

    expect(theCard()).toBeNull();
  });

  it("LP49: where getAlbum answers no card, the welcome item's turn shows the line as before and no card", async () => {
    const { user } = visit([welcomeItem], null);

    await turnTheFirstItem(user);

    expect(theCard()).toBeNull();
    expect(theLesson()).toHaveTextContent("Your next item comes when you thank a teammate with 🌮 and say why.");
  });

  it("LP49: where getAlbum answers no card, nothing holds the items at arrival", async () => {
    visit([thanksItem], null);

    expect(await screen.findByRole("dialog", { name: "Your items" })).toBeInTheDocument();
    expect(theCard()).toBeNull();
  });
});

describe("LP67: the how-it-works card opens once, at the end of the arrival's sequence", { timeout: 30_000 }, () => {
  it("opens over the board once the welcome item has landed, and the board comes back when it closes", async () => {
    visit([welcomeItem, thanksItem]);
    await screen.findByRole("dialog", { name: "Your items" });

    await turnOnFakeTime(within(theItemBoard()!).getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!);

    expect(theCard()).toBeInTheDocument();
    expect(theItemBoard(), "the board under the card").toBeNull();
    await act(async () => fireEvent.click(within(theCard()!).getByRole("button", { name: "Got it" })));
    expect(within(theItemBoard()!).getAllByRole("button", { name: "A face-down item. Turn it over" })).toHaveLength(1);
    expect(theLesson(), "the line the card replaced").toBeNull();
  });
});

describe("LP68: the card shows a hug and a kudos as they look in Slack", () => {
  beforeEach(() => {
    preferReducedMotion();
  });

  it("plays the teammate's message with the member's kudos-emoji reaction and the hug chip, then the member's kudos with its chips, then what the first kudos unlocks", async () => {
    visit([]);
    const card = within(await screen.findByRole("dialog", { name: "How HedgeHug works" }));

    expect(card.getByText("How HedgeHug works")).toBeInTheDocument();
    expect(card.getByRole("heading", { name: "Two ways to thank someone" })).toBeInTheDocument();
    const [hug, kudos] = within(card.getByRole("list", { name: "Two Slack messages" })).getAllByRole("listitem");
    expect(hug).toHaveTextContent("Alex Lee");
    expect(hug).toHaveTextContent("Shipped the fix for the flaky deploy, should be green now.");
    expect(hug).toHaveTextContent("🌮 1");
    expect(hug).toHaveTextContent("Hug · +1 XP each");
    expect(kudos).toHaveTextContent("You");
    expect(kudos).toHaveTextContent("🌮 @Alex Lee thanks for staying on the deploy fix, the release went out on time because of you.");
    expect(kudos).toHaveTextContent("Kudos · +10 XP");
    expect(kudos).toHaveTextContent("said why · +1 item");
    expect(card.getByText("Your first kudos takes you to level 2. Items wait here for you to turn.")).toBeInTheDocument();
    expect(card.getByText(/Level 2 unlocks:/).closest("p")).toHaveTextContent("Level 2 unlocks: Leaderboard · 3 items · your next emoji");
  });

  it("shows a custom kudos emoji as its picture", async () => {
    visit([], { ...newcomersCard, kudos: { kudosEmoji: "hoggo", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hoggo/1.png" } });
    const card = within(await screen.findByRole("dialog", { name: "How HedgeHug works" }));

    expect(card.getAllByRole("img", { name: ":hoggo:" }).map((picture) => picture.getAttribute("src"))).toEqual(["https://emoji.slack-edge.com/T1/hoggo/1.png", "https://emoji.slack-edge.com/T1/hoggo/1.png"]);
  });

  it("for a member already at level 2 or above, leaves out the first sentence and the level-2 row", async () => {
    visit([], { ...newcomersCard, toLevelTwo: false });
    const card = await screen.findByRole("dialog", { name: "How HedgeHug works" });

    expect(card).not.toHaveTextContent("Your first kudos takes you to level 2.");
    expect(card).not.toHaveTextContent("Level 2 unlocks");
    expect(within(card).getByText("Items wait here for you to turn.")).toBeInTheDocument();
  });

  it("plays its beats one after the other, shows the end state with reduced motion, and stacks the messages full width on a phone", () => {
    expect(howItWorksCss, "each beat waits its turn").toMatch(/\.hw-beat \{[^}]*animation-delay: calc\(0\.2s \+ var\(--hw-beat\) \* 0\.6s\);/);
    expect(howItWorksCss, "reduced motion drops every beat").toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.hw-scrim,\s*\.hw-card,\s*\.hw-beat,\s*\.hw-pop \{\s*animation: none;/);
    expect(howItWorksCss, "a phone puts the chips under the message").toMatch(/@media \(max-width: 40rem\) \{[\s\S]*?\.hw-message \{\s*grid-template-columns: 2\.25rem 1fr;\s*\}\s*\.hw-chips \{\s*grid-column: 1 \/ -1;/);
  });
});

describe("LP69: closing the card", () => {
  beforeEach(() => {
    preferReducedMotion();
  });

  it("Try it in Slack opens the member's workspace in a new tab, closes the card and says the member tried Slack", async () => {
    const { actions } = visit([]);
    const tryIt = within(await screen.findByRole("dialog", { name: "How HedgeHug works" })).getByRole("link", { name: "Try it in Slack" });

    expect(tryIt).toHaveAttribute("href", slack);
    expect(tryIt).toHaveAttribute("target", "_blank");
    expect(tryIt).toHaveFocus();
    tryIt.addEventListener("click", (event) => event.preventDefault());
    await act(async () => fireEvent.click(tryIt));

    expect(theCard()).toBeNull();
    expect(actions.closeHowItWorks).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([
    ["Got it", (card: HTMLElement) => fireEvent.click(within(card).getByRole("button", { name: "Got it" }))],
    ["Esc", (card: HTMLElement) => fireEvent.keyDown(within(card).getByRole("link", { name: "Try it in Slack" }), { key: "Escape" })],
  ])("%s closes the card and says the member did not try Slack", async (_, close) => {
    const { actions } = visit([]);
    const card = await screen.findByRole("dialog", { name: "How HedgeHug works" });

    await act(async () => close(card));

    expect(theCard()).toBeNull();
    expect(actions.closeHowItWorks).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("keeps the focus in the card", async () => {
    const { user } = visit([]);
    const card = await screen.findByRole("dialog", { name: "How HedgeHug works" });

    await user.tab();
    expect(within(card).getByRole("button", { name: "Got it" })).toHaveFocus();
    await user.tab();
    expect(within(card).getByRole("link", { name: "Try it in Slack" })).toHaveFocus();
  });

  it("stays closed once the album stops answering it", async () => {
    const { user, closedOnTheServer } = visit([thanksItem]);
    await user.click(within(await screen.findByRole("dialog", { name: "How HedgeHug works" })).getByRole("button", { name: "Got it" }));

    closedOnTheServer();

    expect(theCard()).toBeNull();
    expect(await screen.findByRole("dialog", { name: "Your items" })).toBeInTheDocument();
  });
});
