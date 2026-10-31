import { act, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixturePackOpeningOf, fixtureUnlockOf } from "./albumFixtures";
import type { Album, AlbumEmoji, SeenReply } from "./answer";

const memberWithTheAlbum = shellFixtures.member;

const midway = albumFixtures.midway;

const emojiPage = "https://hedgehug.slack.com/customize/emoji";

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  vi.spyOn(window, "open").mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Visit = { album?: Album; markEmojisSeen?: (ids: string[]) => Promise<SeenReply> };

function asAMemberWhoOpenedTheEmojisBefore(album: Album) {
  localStorage.setItem(`hedgehug:emojis-opened:${album.me.person}`, JSON.stringify(album.emojis.filter(({ earned }) => earned).map(({ id }) => id)));
}

function visit(path: string, { album = midway, markEmojisSeen = async (ids) => ({ kind: "seen", ids }) }: Visit = {}) {
  window.history.replaceState(null, "", path);
  asAMemberWhoOpenedTheEmojisBefore(album);
  const marked = vi.fn(markEmojisSeen);
  const view = renderAlbum(memberWithTheAlbum, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), commands: { markEmojisSeen: marked, openThoughtfulPack: async (pack) => fixturePackOpeningOf(pack) } });
  return { ...view, marked };
}

async function openTheEmojis(view: ReturnType<typeof visit>) {
  const [bar] = await screen.findAllByRole("banner", {}, { timeout: 5_000 });
  await view.user.click(within(bar!).getByRole("button", { name: /^Your emojis/ }));
  return within(screen.getByRole("region", { name: "Your emojis" }));
}

function aMoment() {
  return screen.findByRole("dialog", { name: "New emoji unlocked" }, { timeout: 5_000 });
}

function aBundle() {
  return screen.findByRole("dialog", { name: "New emojis unlocked" }, { timeout: 5_000 });
}

function shelf(popup: ReturnType<typeof within>, title: string) {
  return within(popup.getByRole("region", { name: new RegExp(`^${title}`) }));
}

function rowsIn(region: ReturnType<typeof within>): string[] {
  return region.queryAllByRole("listitem").map((row: HTMLElement) => row.textContent ?? "");
}

function anEmoji(emoji: Partial<AlbumEmoji> & Pick<AlbumEmoji, "id" | "kind" | "name" | "from">): AlbumEmoji {
  return { picture: `/emoji/${emoji.id.replace(":", "-")}.png`, earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 0, need: 3 }, ...emoji };
}

function savedDownloads() {
  const saved: { file: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download !== "") saved.push({ file: this.download, href: this.getAttribute("href")! });
  });
  return saved;
}

type Drawn = { images: string[]; texts: string[] };

function aCanvasThatDraws(failingPictures: (src: string) => boolean): Drawn {
  const drawn: Drawn = { images: [], texts: [] };
  class LoadingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    private source = "";
    get src() {
      return this.source;
    }
    set src(value: string) {
      this.source = value;
      queueMicrotask(() => (failingPictures(value) ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", LoadingImage);
  const gradient = { addColorStop: vi.fn() };
  const context = {
    drawImage: (image: LoadingImage) => drawn.images.push(image.src),
    fillText: (text: string) => drawn.texts.push(text),
    createLinearGradient: () => gradient,
    beginPath: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    clip: vi.fn(),
    restore: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(new Blob(["png"], { type: "image/png" })));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:drawn-emoji", revokeObjectURL: vi.fn() }));
  return drawn;
}

describe("#664 AL29: the emoji popup shows every emoji by kind, each earned one with its picture, its name and what earned it", { timeout: 30_000 }, () => {
  it("groups the emojis as Team stickers, Hype, Milestones and Levels, each earned one in colour with its picture, its name and where it came from", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Your emojis · 9 of 27");
    expect(popup.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Count in kudos · 0 of 5", "Team stickers 1 of 4", "Hype 1", "Milestones 6 of 20", "Levels 1 of 2"]);
    expect(rowsIn(shelf(popup, "Team stickers"))[0]).toBe(":team-quiet-harbour:You unlocked the Quiet Harbour team sticker · 15 Oct 2026In Slack");
    expect(rowsIn(shelf(popup, "Hype"))).toEqual(["IO:ines-okafor-hype:From your first pack for Ines Okafor · 9 Oct 2026Add to Slack"]);
    expect(rowsIn(shelf(popup, "Levels"))[0]).toBe(":level-5:You reached level 5Add to Slack");
    const pictures = [...document.querySelectorAll<HTMLImageElement>(".al-popover .al-emoji-art:not([data-locked]) img")].filter((picture) => picture.closest(".al-kudos-picks") === null).map((picture) => picture.getAttribute("src"));
    expect(pictures).toEqual(expect.arrayContaining(["/emoji/team-support.png", "/emoji/milestone-people-silver.png", "/emoji/level-5.png"]));
    expect(pictures).toHaveLength(5);
  });

  it("a hype emoji collected by reactions says it came from the reactions, not a pack", async () => {
    const view = visit("/", { album: withHypeByReactions(midway, "hype:ines-okafor") });

    const popup = await openTheEmojis(view);

    expect(rowsIn(shelf(popup, "Hype"))).toEqual(["IO:ines-okafor-hype:From your reactions on 10 of Ines Okafor's messages · 9 Oct 2026Add to Slack"]);
  });

  it("the Hype shelf names both ways to collect a hype emoji: a first kudos, or reacting with it on 10 messages", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(shelf(popup, "Hype").getByText("Give someone their first kudos to unlock their hype emoji. Or react with it on 10 of their messages.")).toBeInTheDocument();
  });

  it("#707: groups milestone emojis by milestone, each tier in order from bronze to diamond with its picture, its Slack name and its date or progress", async () => {
    const view = visit("/");
    const milestones = shelf(await openTheEmojis(view), "Milestones");

    expect(milestones.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["Faces in the album 2 of 4", "Full pages 1 of 4"]);
    const faces = within(milestones.getByRole("region", { name: "Faces in the album 2 of 4" }));
    expect(rowsIn(faces)).toEqual([":first-face:Bronze · 28 Sept 2026In Slack", ":familiar-faces:Silver · 16 Oct 2026Add to Slack", ":full-of-friends:Gold · 12 of 25", ":everyone-s-album:Diamond · 12 of 50"]);
    expect([...faces.getAllByRole("listitem")].map((row) => row.querySelector("img")?.getAttribute("src"))).toEqual(["/emoji/milestone-people-bronze.png", "/emoji/milestone-people-silver.png", "/emoji/milestone-people-gold.png", "/emoji/milestone-people-diamond.png"]);

    await view.user.click(milestones.getByRole("button", { name: "Show all · 3 more" }));

    expect(milestones.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["Faces in the album 2 of 4", "Full pages 1 of 4", "Across the company 1 of 4", "Hoggie hunter 1 of 4", "Kudos given 1 of 4"]);
  });

  it("a hype emoji without a face shows the person's initials in the hype colours", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(shelf(popup, "Hype").getByRole("listitem").querySelector(".al-emoji-initials")?.textContent).toBe("IO");
  });

  it("each locked emoji is grey with how to unlock it and the progress so far, a team ready to unlock links to its page", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(rowsIn(shelf(popup, "Team stickers")).slice(1)).toEqual([":team-kettle-works:Everyone on Kettle Works is in: unlock the sticker on its page", ":team-lanterns:Collect all 5 people on Lanterns · 4 of 5", ":team-copper-kite:Collect all 3 people on Copper Kite · 0 of 3"]);
    expect(rowsIn(shelf(popup, "Levels"))[1]).toBe(":level-10:Reach level 10 · 1,210 of 4,500 XP");
    expect(document.querySelectorAll(".al-popover .al-emoji-art[data-locked]")).toHaveLength(9);
    await view.user.click(shelf(popup, "Team stickers").getByRole("link", { name: /Kettle Works/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Kettle Works" })).toBeInTheDocument();
  });

  it("shows the nearest locked emojis of a kind first, then Show all lists the rest, leaving out a team nobody is matched on yet", async () => {
    const nobodyMatched = anEmoji({ id: "team:empty", kind: "team", name: "team-empty", from: "Empty", progress: { have: 0, need: 0 } });
    const teams = [nobodyMatched, ...Array.from({ length: 6 }, (_, index) => anEmoji({ id: `team:team-${index}`, kind: "team", name: `team-${index}`, from: `Team ${index}`, progress: { have: index, need: 6 } }))];
    const view = visit("/", { album: { ...midway, emojis: teams } });
    const popup = await openTheEmojis(view);
    const teamShelf = shelf(popup, "Team stickers");
    expect(rowsIn(teamShelf).map((row) => row.slice(0, row.indexOf(":", 1) + 1))).toEqual([":team-5:", ":team-4:", ":team-3:"]);

    await view.user.click(teamShelf.getByRole("button", { name: "Show all · 3 more" }));

    expect(rowsIn(teamShelf)).toHaveLength(6);
    expect(teamShelf.getByRole("heading", { level: 3 }).textContent).toBe("Team stickers 0 of 6");
    const fewer = teamShelf.getByRole("button", { name: "Show fewer" });
    expect(fewer).toHaveFocus();
    await view.user.keyboard("{Enter}");
    expect(rowsIn(teamShelf)).toHaveLength(3);
    expect(teamShelf.getByRole("button", { name: "Show all · 3 more" })).toHaveFocus();
  });

  it("past the hype emojis getAlbum answers, the popup and its search say there are more", async () => {
    const view = visit("/", { album: { ...midway, moreEmojis: true } });

    const popup = await openTheEmojis(view);

    expect(shelf(popup, "Hype").getByText("You have more hype emojis than the popup lists.")).toBeInTheDocument();
    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "zebra");
    expect(popup.getByText("You have more hype emojis than the popup lists.")).toBeInTheDocument();
  });

  it("an emoji from a milestone this website doesn't know yet still shows, under its own name", async () => {
    const unknown = anEmoji({ id: "milestone:streaks:gold", kind: "milestone", name: "streak-keeper", from: "Streak keeper", progress: null, earned: true, earnedAt: Date.parse("2026-10-17T10:00:00Z") });
    const view = visit("/", { album: { ...midway, emojis: [...midway.emojis, unknown] } });

    const popup = await openTheEmojis(view);

    const milestones = shelf(popup, "Milestones");
    await view.user.click(milestones.getByRole("button", { name: "Show all · 4 more" }));
    expect(rowsIn(within(milestones.getByRole("region", { name: "Streak keeper 1 of 1" })))).toEqual([":streak-keeper:Gold · 17 Oct 2026Add to Slack"]);
  });

  it("random drops show only once one dropped, each with the pack it dropped from", async () => {
    const drop = anEmoji({ id: "random:shipit", kind: "random", name: "shipit", from: "Ines Okafor", picture: "https://emoji.slack-edge.com/T1/shipit/1.png", earned: true, earnedAt: Date.parse("2026-10-17T10:00:00Z"), inSlack: true, progress: null });
    const view = visit("/");
    const popup = await openTheEmojis(view);
    expect(popup.queryByRole("region", { name: /^Random drops/ })).not.toBeInTheDocument();
    view.unmount();

    const withADrop = visit("/", { album: { ...midway, emojis: [...midway.emojis, drop] } });
    const again = await openTheEmojis(withADrop);

    expect(rowsIn(shelf(again, "Random drops"))).toEqual([":shipit:A random drop in your pack for Ines Okafor · 17 Oct 2026In Slack"]);
  });

  it("a search finds emojis by name, team, milestone or person, and says when none matches", async () => {
    const view = visit("/");
    const popup = await openTheEmojis(view);

    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "ines");

    expect(rowsIn(popup)).toEqual(["IO:ines-okafor-hype:From your first pack for Ines Okafor · 9 Oct 2026Add to Slack"]);
    await view.user.clear(popup.getByRole("searchbox", { name: "Find an emoji" }));
    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "heart of the team");
    expect(rowsIn(popup)).toEqual([":heart-of-the-team:Reach gold in Kudos given · 9 of 100"]);
    await view.user.clear(popup.getByRole("searchbox", { name: "Find an emoji" }));
    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "zebra");
    expect(popup.getByText("No emoji matches “zebra”.")).toBeInTheDocument();
  });
});

describe("#664 AL30 AL31: use it in Slack only when Slack has it, and Add to Slack is the member's own download", { timeout: 30_000 }, () => {
  it("an emoji Slack has says to use it in Slack and offers no Add to Slack; one Slack lacks offers Add to Slack", async () => {
    const view = visit("/");
    const popup = await openTheEmojis(view);

    const inSlack = shelf(popup, "Team stickers").getAllByRole("listitem")[0]!;
    expect(within(inSlack).getByText("In Slack")).toHaveAccessibleDescription("Use it in Slack: react with it and put it in the kudos you give.");
    expect(within(inSlack).queryByRole("button", { name: /Add to Slack/ })).not.toBeInTheDocument();
    expect(within(shelf(popup, "Hype").getByRole("listitem")).getByRole("button", { name: "Add to Slack: :ines-okafor-hype:" })).toHaveTextContent("Add to Slack");
  });

  it("Add to Slack on a level emoji downloads its static picture as <name>.png, copies the name and opens the workspace's custom emoji page", async () => {
    const saved = savedDownloads();
    const copied = vi.fn(async () => undefined);
    const view = visit("/");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    const popup = await openTheEmojis(view);
    const levelFive = within(shelf(popup, "Levels").getAllByRole("listitem")[0]!);

    await view.user.click(levelFive.getByRole("button", { name: "Add to Slack: :level-5:" }));

    await waitFor(() => expect(saved).toEqual([{ file: "level-5.png", href: "/emoji/level-5.png" }]));
    expect(copied).toHaveBeenCalledExactlyOnceWith(":level-5:");
    expect(window.open).toHaveBeenCalledExactlyOnceWith(emojiPage, "_blank", "noopener,noreferrer");
    expect(await levelFive.findByRole("status")).toHaveTextContent("Saved level-5.png and copied :level-5:. Add it on Slack's emoji page under that name.");
  });

  it("Add to Slack on a hype emoji draws the face in its frame; where the face can't be drawn it saves the hype emblem with the person's initials", async () => {
    const saved = savedDownloads();
    const facePicture = "https://res.cloudinary.com/posthog/ines.png";
    const withAFace = { ...midway, emojis: midway.emojis.map((emoji) => (emoji.kind === "hype" ? { ...emoji, picture: facePicture } : emoji)) };
    const drawn = aCanvasThatDraws((src) => src === facePicture);
    const view = visit("/", { album: withAFace });
    const popup = await openTheEmojis(view);

    await view.user.click(shelf(popup, "Hype").getByRole("button", { name: "Add to Slack: :ines-okafor-hype:" }));

    await waitFor(() => expect(saved).toEqual([{ file: "ines-okafor-hype.png", href: "blob:drawn-emoji" }]));
    expect(drawn).toEqual({ images: [], texts: ["IO"] });
  });

  it("Add to Slack on a hype emoji whose face draws saves the framed face", async () => {
    const saved = savedDownloads();
    const facePicture = "https://res.cloudinary.com/posthog/ines.png";
    const withAFace = { ...midway, emojis: midway.emojis.map((emoji) => (emoji.kind === "hype" ? { ...emoji, picture: facePicture } : emoji)) };
    const drawn = aCanvasThatDraws(() => false);
    const view = visit("/", { album: withAFace });
    const popup = await openTheEmojis(view);

    await view.user.click(shelf(popup, "Hype").getByRole("button", { name: "Add to Slack: :ines-okafor-hype:" }));

    await waitFor(() => expect(saved).toEqual([{ file: "ines-okafor-hype.png", href: "blob:drawn-emoji" }]));
    expect(drawn).toEqual({ images: [facePicture], texts: [] });
  });

  it("without the workspace's Slack address, Add to Slack still saves the picture and says where to add it", async () => {
    const saved = savedDownloads();
    const view = visit("/", { album: { ...midway, emojiPage: null } });
    const popup = await openTheEmojis(view);
    const levelFive = within(shelf(popup, "Levels").getAllByRole("listitem")[0]!);

    await view.user.click(levelFive.getByRole("button", { name: "Add to Slack: :level-5:" }));

    await waitFor(() => expect(saved).toEqual([{ file: "level-5.png", href: "/emoji/level-5.png" }]));
    expect(window.open).not.toHaveBeenCalled();
    expect(await levelFive.findByRole("status")).toHaveTextContent("Saved level-5.png. In Slack, add it as :level-5: under Customize workspace, Emoji.");
  });
});

describe("AL26: an earned emoji is marked seen only once its moment has shown", { timeout: 30_000 }, () => {
  const fresh = albumFixtures.newEmojis;

  const sevenWaiting: Album = {
    ...fresh,
    emojis: [
      ...fresh.emojis,
      ...["dax-holm", "eli-roan", "ivo-penn"].map((person, index) => anEmoji({ id: `hype:${person}`, kind: "hype", name: `${person}-hype`, from: person, picture: "/emoji/hype.png", earned: true, earnedAt: Date.now() - index, progress: null })),
    ],
  };

  function cardsIn(bundle: HTMLElement) {
    return within(within(bundle).getByRole("list", { name: "Your new emojis" })).getAllByRole("listitem");
  }

  it("a waiting hype emoji collected by reactions names the reactions in the bundle", async () => {
    preferReducedMotion();
    visit("/", { album: withHypeByReactions(fresh, "hype:bram-teller") });

    const cards = cardsIn(await aBundle());

    expect(cards[2]).toHaveTextContent("Your reactions on 10 of Bram Teller's messages");
    expect(cards[3]).toHaveTextContent("Your first pack for Fen Marlowe");
  });

  it("#721: several waiting emojis open as one bundle showing each one's picture, its name and what it came from, and only taking it sends markEmojisSeen, once, for all of them", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });

    const bundle = await aBundle();

    expect(view.marked).not.toHaveBeenCalled();
    expect(within(bundle).getByRole("heading", { level: 2 }).textContent).toBe("4 new emojis unlocked");
    const cards = cardsIn(bundle);
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([":team-quiet-harbour:", ":level-5:", ":bram-teller-hype:", ":fen-marlowe-hype:"]);
    expect(cards[0]).toHaveTextContent("The Quiet Harbour team sticker");
    expect(cards[1]).toHaveTextContent("Reaching level 5");
    expect(cards[2]).toHaveTextContent("Your first pack for Bram Teller");
    expect(cards.every((card) => card.querySelector(".al-emoji-art") !== null)).toBe(true);
    await view.user.click(within(bundle).getByRole("button", { name: "Add to my emojis" }));

    expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour", "level:5", "hype:bram-teller", "hype:fen-marlowe"]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument());
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));
    expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument();
  });

  it("#721: an emoji in Slack says to use it there; one Slack doesn't have yet says so, with no download and no Add to Slack", async () => {
    preferReducedMotion();
    visit("/", { album: fresh });

    const bundle = await aBundle();

    const [inSlack, notInSlack] = cardsIn(bundle);
    expect(inSlack).toHaveTextContent("Use it in Slack");
    expect(notInSlack).toHaveTextContent("Not in Slack yet");
    expect(notInSlack).not.toHaveTextContent("Use it in Slack");
    expect(within(bundle).queryByRole("button", { name: /Add to Slack/ })).not.toBeInTheDocument();
    expect(bundle).not.toHaveTextContent(/Add it to Slack|download/i);
  });

  it("#721: past five waiting, the bundle shows five and +N more, which marks every waiting emoji seen and opens the emoji popup", async () => {
    preferReducedMotion();
    const view = visit("/", { album: sevenWaiting });
    const bundle = await aBundle();

    expect(within(bundle).getByRole("heading", { level: 2 }).textContent).toBe("7 new emojis unlocked");
    expect(cardsIn(bundle)).toHaveLength(5);
    await view.user.click(within(bundle).getByRole("button", { name: "+2 more" }));

    expect(view.marked).toHaveBeenCalledExactlyOnceWith(sevenWaiting.emojis.filter(({ earned, seen }) => earned && !seen).map(({ id }) => id));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument());
    expect(await screen.findByRole("region", { name: "Your emojis" })).toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));
    expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument();
  });

  it("#721: +N more opens the emoji popup on a Just unlocked list holding every emoji it marked seen, past what a shelf shows", async () => {
    preferReducedMotion();
    const people = ["ada", "bo", "cy", "di", "ed", "fi", "gus", "hal", "ida", "jo", "kai", "lu"];
    const twelveHype: Album = { ...fresh, emojis: [...midway.emojis, ...people.map((person, index) => anEmoji({ id: `hype:${person}`, kind: "hype", name: `${person}-hype`, from: person, picture: "/emoji/hype.png", earned: true, earnedAt: Date.now() - index * 60_000, progress: null }))] };
    const view = visit("/", { album: twelveHype });
    const bundle = await aBundle();

    await view.user.click(within(bundle).getByRole("button", { name: "+7 more" }));

    const justUnlocked = within(await screen.findByRole("region", { name: "Just unlocked" }));
    expect(rowsIn(justUnlocked).map((row) => row.match(/:[a-z-]+:/)?.[0])).toEqual(people.map((person) => `:${person}-hype:`));
    expect(view.marked).toHaveBeenCalledExactlyOnceWith(people.map((person) => `hype:${person}`));
  });

  it("#721: with motion, Escape before the cards have risen waits for them, then flies them in and sends markEmojisSeen", async () => {
    const view = visit("/", { album: fresh });
    await aBundle();

    await view.user.keyboard("{Escape}");
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_400)));

    expect(view.marked).not.toHaveBeenCalled();
    await waitFor(() => expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour", "level:5", "hype:bram-teller", "hype:fen-marlowe"]), { timeout: 5_000 });
  });

  it("#721: taking a bundle of five marks only those five, and the rest come next as one more bundle", async () => {
    preferReducedMotion();
    const view = visit("/", { album: sevenWaiting });
    const first = await aBundle();
    const shown = cardsIn(first).map((card) => within(card).getByRole("heading", { level: 3 }).textContent);

    await view.user.click(within(first).getByRole("button", { name: "Add to my emojis" }));

    expect(shown).toEqual([":team-quiet-harbour:", ":level-5:", ":bram-teller-hype:", ":fen-marlowe-hype:", ":dax-holm-hype:"]);
    expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour", "level:5", "hype:bram-teller", "hype:fen-marlowe", "hype:dax-holm"]);
    const next = await aBundle();
    await waitFor(() => expect(within(next).getByRole("heading", { level: 2 }).textContent).toBe("2 new emojis unlocked"));
    expect(cardsIn(next).map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([":eli-roan-hype:", ":ivo-penn-hype:"]);
  });

  it("#721: a single waiting emoji keeps its own moment with its picture, its name and why it was earned", async () => {
    preferReducedMotion();
    const view = visit("/", { album: { ...fresh, emojis: fresh.emojis.filter(({ id }) => id !== "level:5" && !id.startsWith("hype:")) } });

    const moment = await aMoment();

    expect(within(moment).getByRole("heading", { level: 2 }).textContent).toBe(":team-quiet-harbour:");
    expect(moment).toHaveTextContent("You unlocked the Quiet Harbour team sticker · 15 Oct 2026");
    expect(moment).toHaveTextContent("Use it in Slack: react with it and put it in the kudos you give.");
    expect(within(moment).queryByRole("list", { name: "Your new emojis" })).not.toBeInTheDocument();
    await view.user.click(within(moment).getByRole("button", { name: "Add to my emojis" }));
    expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour"]);
  });

  it("the moment takes focus itself and names its emojis, so a keystroke can't take it unread", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });

    const bundle = await aBundle();

    expect(bundle).toHaveFocus();
    expect(bundle).toHaveAccessibleDescription(expect.stringMatching(/^:team-quiet-harbour: The Quiet Harbour team sticker .*:fen-marlowe-hype:/));
    await view.user.keyboard(" ");
    expect(view.marked).not.toHaveBeenCalled();
  });

  it("when the moment goes, focus returns to where the member was", async () => {
    preferReducedMotion();
    const view = visit("/", { album: { ...fresh, emojis: fresh.emojis.filter(({ id }) => id !== "level:5" && !id.startsWith("hype:")) } });
    const search = await screen.findByRole("searchbox", { name: "Search teams and people" }, { timeout: 5_000 });
    search.focus();
    const moment = await aMoment();
    expect(moment).toHaveFocus();

    await view.user.click(within(moment).getByRole("button", { name: "Add to my emojis" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument());
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("while more packs wait than getAlbum lists, every hype emoji waits, since its pack may be one of them", async () => {
    preferReducedMotion();
    visit("/", { album: { ...fresh, morePacks: true } });

    const bundle = await aBundle();

    expect(cardsIn(bundle).map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([":team-quiet-harbour:", ":level-5:"]);
  });

  it("AL54: a team sticker's unlock moment counts as its team emoji's moment, which never plays a second time", async () => {
    preferReducedMotion();
    const live = { album: midway as Album, listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/book#teams/kettle-works");
    const marked = vi.fn(async (ids: string[]) => ({ kind: "seen", ids }) as const);
    const unlocked = async (team: string) => {
      live.album = { ...midway, teams: midway.teams.map((page) => (page.team === team ? { ...page, state: "unlocked" as const, unlockedAt: Date.now() } : page)), emojis: midway.emojis.map((emoji) => (emoji.id === `team:${team}` ? { ...emoji, earned: true, earnedAt: Date.now(), progress: null } : emoji)) };
      return fixtureUnlockOf(midway, team);
    };
    const { user } = renderAlbum(memberWithTheAlbum, read, { commands: { unlockTeamSticker: unlocked, markEmojisSeen: marked } });

    await user.click(await screen.findByRole("button", { name: "Ready to unlock the Kettle Works sticker" }, { timeout: 5_000 }));
    act(() => live.listeners.forEach((listener) => listener()));
    await user.click(await screen.findByRole("button", { name: "Put it on the page" }));

    await waitFor(() => expect(marked).toHaveBeenCalledExactlyOnceWith(["team:kettle-works"]));
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));
    expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument();
  });

  it("Escape takes the bundle like its button, and a refused or unreachable markEmojisSeen still closes it", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh, markEmojisSeen: async () => Promise.reject(new Error("unreachable")) });
    await aBundle();

    await view.user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument());
    expect(view.marked.mock.calls).toEqual([[["team:quiet-harbour", "level:5", "hype:bram-teller", "hype:fen-marlowe"]]]);
  });

  it("#721: with motion, taking the bundle flies its emojis into the emoji button and only then sends markEmojisSeen", async () => {
    const view = visit("/", { album: fresh });
    const bundle = await aBundle();

    await view.user.click(within(bundle).getByRole("button", { name: "Add to my emojis" }));

    expect(view.marked).not.toHaveBeenCalled();
    await waitFor(() => expect(view.marked).toHaveBeenCalledOnce(), { timeout: 5_000 });
  });

  it("a hype emoji waits while its person's pack is still unopened, and an emoji seen before never pops", async () => {
    const waitingFor = midway.packs[0]!.person;
    const album = { ...midway, emojis: [...midway.emojis, anEmoji({ id: `hype:${waitingFor}`, kind: "hype", name: `${waitingFor}-hype`, from: "Juno Park", earned: true, earnedAt: Date.now(), progress: null })] };
    visit("/", { album });

    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));

    expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument();
  });

  it("AL54: no moment plays while a pack opening is open; it waits until the opening closes", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });
    const [bar] = await screen.findAllByRole("banner");
    await view.user.click(within(bar!).getByRole("button", { name: /^Open your packs/ }));
    expect(await screen.findByRole("dialog", { name: /pack/i }, { timeout: 5_000 })).toBeInTheDocument();

    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));

    expect(screen.queryByRole("dialog", { name: /^New emojis? unlocked$/ })).not.toBeInTheDocument();
    await view.user.keyboard("{Escape}");
    expect(await aBundle()).toBeInTheDocument();
  });
});

describe("#664 AL32: the Settings page shows workspace admins the shared list", { timeout: 30_000 }, () => {
  it("an admin sees every team, milestone and level emoji with its picture, its name, what earns it and whether Slack has it", async () => {
    visit("/settings", { album: albumFixtures.admin });

    const list = within(await screen.findByRole("region", { name: "Shared emojis" }));

    const rows = rowsIn(list);
    expect(rows.slice(0, 5)).toEqual([
      ":team-quiet-harbour:The Quiet Harbour team stickerIn Slack",
      ":team-lanterns:The Lanterns team stickerAdd to Slack",
      ":team-kettle-works:The Kettle Works team stickerAdd to Slack",
      ":team-copper-kite:The Copper Kite team stickerAdd to Slack",
      ":first-face:Bronze in Faces in the album: First faceIn Slack",
    ]);
    expect(rows).toContain(":heart-of-the-team:Gold in Kudos given: Heart of the teamAdd to Slack");
    expect(rows.slice(-2)).toEqual([":level-5:Reaching level 5Add to Slack", ":level-10:Reaching level 10Add to Slack"]);
    expect(rows).toHaveLength(26);
    expect(list.getByText("2 of 26 in Slack")).toBeInTheDocument();
  });

  it("a member who is no admin sees no shared list", async () => {
    visit("/settings");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Shared emojis" })).not.toBeInTheDocument();
  });
});

function withHypeByReactions(album: Album, id: string): Album {
  return { ...album, emojis: album.emojis.map((emoji) => (emoji.id === id ? { ...emoji, byReactions: true } : emoji)) };
}
