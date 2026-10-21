import { act, fireEvent, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberId } from "../../../convex/workspace/directory";
import { shellFixtures, type TurnReply } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedPeople, fixtureTurnOf } from "./albumFixtures";
import type { Album, AlbumHoggies, AlbumRead, HoggiesRead } from "./answer";
import { hoggiesFixtures } from "./hoggiesFixtures";

const withItems = albumFixtures.withItems;

const firstItem = withItems.board!.items[0]!.item;

const unlockedAt = Date.parse("2026-10-20T10:00:00Z");

const tinOrchard = { team: "tin-orchard", name: "Tin Orchard", art: { kind: "crest" as const, slug: "replay" }, emoji: "team-tin-orchard", at: unlockedAt };

const itemBoardCss = readFileSync(join(__dirname, "itemBoard.css"), "utf8");

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
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
    listeners.forEach((listener) => listener());
  };
  return { read, answerNext, now: () => answer };
}

function withTheHoggieTurned(album: Album, item: string): Album {
  return { ...album, board: { ...album.board!, items: album.board!.items.filter((waiting) => waiting.item !== item) }, level: { ...album.level, xp: album.level.xp + 15 } };
}

function withTinOrchardFilled(album: Album, item: string): Album {
  return {
    ...album,
    board: { ...album.board!, items: album.board!.items.filter((waiting) => waiting.item !== item) },
    people: album.people.map((someone) => (someone.person === "cass-vey" ? { ...someone, held: true } : someone)),
    teams: album.teams.map((team) => (team.team === "tin-orchard" ? { ...team, held: team.total, state: "unlocked", unlockedAt } : team)),
  };
}

function aStickerTurnOfCassVey(unlocked: Extract<TurnReply, { kind: "turned" }>["unlocked"]): TurnReply {
  const thanked = withItems.people.find(({ person }) => person === "cass-vey")!;
  return { kind: "turned", face: { kind: "sticker", person: "cass-vey" as MemberId, isNew: true, thanked: { name: thanked.name, face: thanked.face } }, applied: null, page: { kind: "team", team: "tin-orchard" }, unlocked, again: false };
}

function theDanceFound(): AlbumHoggies {
  const midway = hoggiesFixtures.midway;
  const before = midway.hoggies.find(({ hoggie }) => hoggie === "70s-dance")!;
  const dance = { ...before, count: 1, found: true, spares: 0, firstAt: Date.parse("2026-10-21T09:00:00Z") };
  return { ...midway, hoggies: midway.hoggies.map((hoggie) => (hoggie.hoggie === "70s-dance" ? dance : { ...hoggie, firstAt: hoggie.firstAt === null ? null : Math.min(hoggie.firstAt, Date.parse("2026-10-01T09:00:00Z")) })), found: before.found ? midway.found : midway.found + 1, rarest: [dance, ...midway.rarest.filter(({ hoggie }) => hoggie !== "70s-dance")].slice(0, 5) };
}

type Visit = { album?: Album; reply?: (item: string) => Promise<TurnReply>; after?: (album: Album, item: string) => Album; hoggies?: AlbumHoggies };

function visit({ album = withItems, reply = async (item) => fixtureTurnOf(item), after = withTheHoggieTurned, hoggies = theDanceFound() }: Visit = {}) {
  window.history.replaceState(null, "", "/book#me");
  const live = anAlbumThatAnswers(album);
  const turnItem = vi.fn(async (item: string) => {
    const answer = await reply(item);
    if (answer.kind === "turned") live.answerNext(after(live.now(), item));
    return answer;
  });
  const hoggiesRead: HoggiesRead = (asking) => (asking ? hoggies : undefined);
  const view = renderAlbum(shellFixtures.member, live.read, { hoggies: hoggiesRead, people: fixedPeople(withItems), commands: { turnItem } });
  return { ...view, turnItem, live };
}

const arrival = { timeout: 10_000 };

async function theFirstItem() {
  const board = within(await screen.findByRole("dialog", { name: "Your items" }, arrival));
  return board.getAllByRole("button", { name: "A face-down item. Turn it over" })[0]!;
}

let clicked = 0;

async function clickOnFakeTime(item: HTMLElement) {
  vi.useFakeTimers();
  clicked = Date.now();
  await act(async () => fireEvent.click(item));
}

const frameMs = 16;

async function at(seconds: number) {
  const due = clicked + Math.round(seconds * 1000);
  while (Date.now() < due) await act(() => vi.advanceTimersByTimeAsync(Math.min(frameMs, due - Date.now())));
}

function ground() {
  return document.querySelector<HTMLElement>(".ib-ground");
}

function stage() {
  return ground()?.dataset.stage ?? "gone";
}

function dark() {
  return ground()?.hasAttribute("data-dark") ?? false;
}

function caption() {
  return document.querySelector<HTMLElement>(".ib-caption");
}

function xpWords() {
  return within(screen.getAllByRole("banner", { hidden: true })[0]!).getByText(/XP to level/, { selector: ".al-xp-words" }).textContent;
}

function thePlate() {
  return document.querySelector<HTMLElement>('[data-hoggie="70s-dance"]');
}

function tinOrchardInTheSidebar() {
  return within(screen.getByRole("navigation", { name: "Album" })).getByRole("link", { name: /Tin Orchard/ });
}

function theSpotOfCassVey() {
  return screen.getByText("Cass Vey", { selector: ".al-photo-name" }).closest("li");
}

function placeTheSealInView() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rectOf(this: Element) {
    return this.matches(".al-seal-spot, [data-al-seal]") ? new DOMRect(400, 300, 160, 130) : new DOMRect(0, 0, 0, 0);
  });
}

describe("LP18 LP19 LP21: the Page-first turn sequence at 0.8×", { timeout: 30_000 }, () => {
  it("lands a hoggie's stages at LP18's times: the page at 0.36 s, the turn at 0.76 s, the hold at 1.7 s, the fade from 2.5 to 2.8 s, the drop at 3.1 s and the board back at 5.3 s", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { turnItem } = visit();
    await clickOnFakeTime(await theFirstItem());

    await at(0.26);
    expect(window.location.hash).toBe("#me");
    expect(dark(), "the page cross-fades from 0.03 s").toBe(true);
    await at(0.46);
    expect(window.location.hash).toBe("#hoggies");
    expect(dark(), "the page shows at 0.36 s").toBe(false);

    await at(0.66);
    expect(stage()).toBe("lift");
    await at(0.86);
    expect(stage()).toBe("turn");

    await at(1.6);
    expect(caption()).toBeNull();
    await at(1.8);
    expect(stage()).toBe("hold");
    expect(caption()).toHaveTextContent("70's DanceRare hoggie · New");

    await at(2.4);
    expect(dark()).toBe(false);
    await at(2.6);
    expect(dark(), "the fade to the slot").toBe(true);
    expect(scrolled.mock.contexts).not.toContain(thePlate());
    await at(2.9);
    expect(scrolled.mock.contexts).toContain(thePlate());
    expect(scrolled).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "instant" }));
    expect(dark()).toBe(false);

    await at(3.0);
    expect(stage()).toBe("hold");
    await at(3.2);
    expect(stage()).toBe("land");

    await at(5.2);
    expect(stage()).not.toBe("back");
    await at(5.4);
    expect(stage()).toBe("back");
    await at(5.9);
    expect(stage()).toBe("idle");
    expect(screen.getByRole("heading", { name: "2 items wait" })).toBeVisible();
    expect(turnItem).toHaveBeenCalledTimes(1);
  });

  it("keeps the hoggie off the page until it lands: the top of Hoggies names no new find and its plate waits empty", async () => {
    visit();
    await clickOnFakeTime(await theFirstItem());

    await at(0.46);
    const main = within(screen.getByRole("main"));
    expect(main.queryByText("70's Dance")).toBeNull();
    expect(thePlate()).toHaveTextContent("Not found yet");

    await at(4.1);
    expect(thePlate()).toHaveTextContent("70's Dance");
    expect(thePlate()).toHaveAttribute("data-landed");
  });

  it("flies the +15 XP chip to the bar during the hold, and the bar moves only once it lands", async () => {
    visit();
    await clickOnFakeTime(await theFirstItem());

    await at(2.0);
    expect(xpWords()).toBe("290 XP to level 7");
    expect(screen.getByText("+15 XP", { selector: ".ib-chip" })).toBeInTheDocument();
    await at(3.1);
    expect(xpWords()).toBe("275 XP to level 7");
    expect(document.querySelector(".ib-chip")).toBeNull();
  });

  it("lands a sticker that fills its team, then unlocks the team sticker as the follow-up: a gold burst, the seal colours, Unlocked with its date, its emoji and New, and the board back after about 8.8 s", async () => {
    placeTheSealInView();
    visit({ reply: async () => aStickerTurnOfCassVey({ teamStickers: [tinOrchard], hype: null, milestones: [] }), after: withTinOrchardFilled });
    await clickOnFakeTime(await theFirstItem());

    await at(0.46);
    expect(window.location.hash).toBe("#teams/tin-orchard");
    expect(screen.getByRole("img", { name: "Tin Orchard sticker, 2 of 3" })).toBeInTheDocument();
    await at(1.8);
    expect(caption()).toHaveTextContent("Cass VeySticker · New");
    expect(within(tinOrchardInTheSidebar()).getByRole("img", { name: "2 of 3" })).toBeInTheDocument();

    await at(4.1);
    expect(screen.getByRole("img", { name: "Tin Orchard sticker, 3 of 3" })).toBeInTheDocument();
    expect(screen.queryByText(/^Unlocked /)).toBeNull();
    expect(document.querySelector(".ib-flourish")).toBeNull();

    await at(4.8);
    expect(stage()).toBe("unlock");
    expect(screen.getByRole("img", { name: "Tin Orchard sticker, unlocked" })).toBeInTheDocument();
    expect(document.querySelector(".ib-flourish")).not.toBeNull();
    const tag = screen.getByText(/^Unlocked /).closest("p")!;
    expect(tag).toHaveTextContent("Unlocked 20 Oct");
    expect(tag).toHaveTextContent(":team-tin-orchard:");
    expect(tag).toHaveTextContent("New");
    expect(within(tinOrchardInTheSidebar()).getByRole("img", { name: "Unlocked" })).toBeInTheDocument();

    await at(7.2);
    expect(stage()).toBe("unlock");
    await at(8.2);
    expect(stage()).toBe("rest");
    await at(8.4);
    expect(stage()).toBe("back");
    await at(8.9);
    expect(stage()).toBe("idle");
  });

  it("pops the thanked person's hype emoji in beside their sticker only once it lands", async () => {
    const hype = { name: "cass-vey-hype", picture: "/emoji/hype-cass.png", inSlack: false };
    visit({ reply: async () => aStickerTurnOfCassVey({ teamStickers: [], hype, milestones: [] }), after: (album, item) => ({ ...withTinOrchardFilled(album, item), teams: album.teams }) });
    await clickOnFakeTime(await theFirstItem());

    await at(1.8);
    expect(screen.queryByRole("img", { name: ":cass-vey-hype: hype emoji unlocked" })).toBeNull();
    await at(4.1);
    expect(screen.getByRole("img", { name: ":cass-vey-hype: hype emoji unlocked" })).toBeInTheDocument();
  });

  it("keeps New off a sticker's spot on its page until the sticker lands", async () => {
    const lastVisit = Date.parse("2026-10-19T10:00:00Z");
    const putIn = (album: Album, item: string) => {
      const filled = withTinOrchardFilled(album, item);
      return { ...filled, teams: album.teams, people: filled.people.map((someone) => (someone.person === "cass-vey" ? { ...someone, at: unlockedAt } : someone)) };
    };
    visit({ album: { ...withItems, lastVisit }, reply: async () => aStickerTurnOfCassVey({ teamStickers: [], hype: null, milestones: [] }), after: putIn });
    await clickOnFakeTime(await theFirstItem());

    await at(1.8);
    expect(theSpotOfCassVey()).toHaveTextContent("Not in your album yet");
    expect(theSpotOfCassVey()).not.toHaveTextContent("New");
    await at(4.1);
    expect(theSpotOfCassVey()).toHaveTextContent("In your album");
    expect(theSpotOfCassVey()).toHaveTextContent("New");
  });

  it.each([
    ["a second click", () => fireEvent.pointerDown(document.body)],
    ["Enter", () => fireEvent.keyDown(window, { key: "Enter" })],
    ["Space", () => fireEvent.keyDown(window, { key: " " })],
    ["Esc", () => fireEvent.keyDown(window, { key: "Escape" })],
  ])("jumps the running item into its slot on %s, without sending the turn twice, and rests before the board comes back", async (_, skip) => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { turnItem } = visit();
    const item = await theFirstItem();
    await clickOnFakeTime(item);

    await at(1.0);
    await act(async () => skip());
    expect(stage()).toBe("rest");
    expect(thePlate()).toHaveAttribute("data-landed");
    expect(thePlate()).toHaveTextContent("70's Dance");
    expect(scrolled.mock.contexts).toContain(thePlate());
    expect(xpWords()).toBe("275 XP to level 7");
    await act(async () => fireEvent.click(item));
    expect(turnItem).toHaveBeenCalledTimes(1);

    await at(2.1);
    expect(stage()).toBe("back");
    await at(2.6);
    expect(stage()).toBe("idle");
    expect(screen.getByRole("dialog", { name: "Your items" })).toBeInTheDocument();
  });

  it("waits for the turn's answer when skipped before it comes, then lands at once", async () => {
    let answer: (reply: TurnReply) => void = () => undefined;
    const { turnItem } = visit({ reply: () => new Promise((resolve) => (answer = resolve)) });
    await clickOnFakeTime(await theFirstItem());

    await at(0.2);
    await act(async () => fireEvent.pointerDown(document.body));
    await at(1.0);
    expect(window.location.hash).toBe("#me");
    await act(async () => answer(fixtureTurnOf(firstItem)));
    expect(stage()).toBe("rest");
    expect(window.location.hash).toBe("#hoggies");
    expect(thePlate()).toHaveAttribute("data-landed");
    expect(turnItem).toHaveBeenCalledTimes(1);
  });

  it("brings the board back with the trouble said when the turn is refused mid-flight", async () => {
    visit({ reply: async () => ({ kind: "refused" }) });
    await clickOnFakeTime(await theFirstItem());

    await at(0.5);
    expect(stage()).toBe("idle");
    expect(window.location.hash).toBe("#me");
    expect(within(screen.getByRole("dialog", { name: "Your items" })).getByRole("alert")).toHaveTextContent("That item couldn't be turned over. Try again.");
  });

  it("closes the board after the rest when the last item has turned", async () => {
    const single = { ...withItems, board: { ...withItems.board!, items: withItems.board!.items.slice(0, 1) } };
    window.history.replaceState(null, "", "/book#me");
    const live = anAlbumThatAnswers(single);
    const turnItem = vi.fn(async (item: string) => {
      live.answerNext(withTheHoggieTurned(live.now(), item));
      return fixtureTurnOf(item);
    });
    const found = theDanceFound();
    renderAlbum(shellFixtures.member, live.read, { hoggies: (asking) => (asking ? found : undefined), commands: { turnItem } });
    await clickOnFakeTime(await theFirstItem());

    await at(4.1);
    expect(stage()).toBe("land");
    expect(screen.getByRole("status", { name: "Turned over" })).not.toHaveTextContent("70's Dance");
    await at(5.4);
    expect(ground()).toBeNull();
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("70's Dance: Rare hoggie · New");
  });

  it("never changes the page or says where an item goes on hover, and the pointer that taps the first item goes once the member hovers", async () => {
    const { user, turnItem } = visit();
    const item = await theFirstItem();
    const dialog = screen.getByRole("dialog", { name: "Your items" });
    const words = dialog.textContent;
    expect(item.closest("li")!.querySelector(".ib-pointer")).not.toBeNull();

    await user.hover(item);

    expect(window.location.hash).toBe("#me");
    expect(dialog.textContent).toBe(words);
    expect(turnItem).not.toHaveBeenCalled();
    expect(document.querySelector(".ib-pointer")).toBeNull();
  });

  it("runs the same flow on a phone, with 72 px items", async () => {
    window.matchMedia = ((query: string) => ({ media: query, matches: false, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    visit();
    await clickOnFakeTime(await theFirstItem());

    await at(0.86);
    expect(stage()).toBe("turn");
    await at(3.2);
    expect(stage()).toBe("land");
    await at(5.9);
    expect(stage()).toBe("idle");
    expect(itemBoardCss).toMatch(/@media \(max-width: 40rem\) \{\s*\.ib-slot \{\s*width: calc\(4\.5rem \* var\(--size, 1\)\);\s*height: calc\(4\.5rem \* var\(--size, 1\)\);/);
  });

  it("keeps the plain path under reduced motion: a click puts the item in place at once and says what it was, with no flight", async () => {
    preferReducedMotion();
    visit();
    await clickOnFakeTime(await theFirstItem());

    await at(0.05);
    expect(ground()).toBeNull();
    expect(document.querySelector(".ib-flyer")).toBeNull();
    expect(window.location.hash).toBe("#hoggies");
    expect(screen.getByRole("status", { name: "Turned over" })).toHaveTextContent("70's Dance: Rare hoggie · New+15 XP");
    expect(xpWords()).toBe("275 XP to level 7");
  });

  it("holds a level the turn's XP crosses until the chip lands, and plays the level's emoji moment only once the board is back", async () => {
    const levelSeven = { ...withItems.emojis.find(({ id }) => id === "level:10")!, id: "level:7", name: "level-7", from: "Level 7", earned: true, seen: false, progress: null };
    const crossing = (album: Album, item: string): Album => ({ ...withTheHoggieTurned(album, item), level: { level: 7, xp: 1505, startsAt: 1500, nextAt: 2100 }, emojis: [...album.emojis, levelSeven] });
    visit({ after: crossing });
    await clickOnFakeTime(await theFirstItem());

    await at(2.0);
    expect(xpWords()).toBe("290 XP to level 7");
    await at(3.1);
    expect(xpWords()).toBe("595 XP to level 8");
    await at(5.0);
    expect(screen.queryByRole("dialog", { name: /emoji/i })).toBeNull();
    expect(stage()).toBe("rest");
    await at(7.0);
    expect(screen.getByRole("dialog", { name: /emoji/i })).toBeInTheDocument();
  });
});
