import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixturePackOpeningOf } from "./albumFixtures";
import type { Album, AlbumEmoji, SeenReply } from "./answer";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

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

function visit(path: string, { album = midway, markEmojisSeen = async (ids) => ({ kind: "seen", ids }) }: Visit = {}) {
  window.history.replaceState(null, "", path);
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

    expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Your emojis · 3 of 9");
    expect(popup.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Team stickers1 of 4", "Hype1", "Milestones0 of 2", "Levels1 of 2"]);
    expect(rowsIn(shelf(popup, "Team stickers"))[0]).toBe(":quiet-harbour:You unlocked the Quiet Harbour team sticker · 15 Oct 2026In Slack");
    expect(rowsIn(shelf(popup, "Hype"))).toEqual(["IO:ines-okafor-hype:From your first thoughtful pack for Ines Okafor · 9 Oct 2026Add to Slack"]);
    expect(rowsIn(shelf(popup, "Levels"))[0]).toBe(":level-5:You reached level 5Add to Slack");
    const pictures = [...document.querySelectorAll<HTMLImageElement>(".al-popover .al-emoji-art:not([data-locked]) img")].map((picture) => picture.getAttribute("src"));
    expect(pictures).toEqual(["/emoji/team-support.png", "/emoji/level-5.png"]);
  });

  it("a hype emoji without a face shows the person's initials in the hype colours", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(shelf(popup, "Hype").getByRole("listitem").querySelector(".al-emoji-initials")?.textContent).toBe("IO");
  });

  it("each locked emoji is grey with how to unlock it and the progress so far, a team ready to unlock links to its page", async () => {
    const view = visit("/");

    const popup = await openTheEmojis(view);

    expect(rowsIn(shelf(popup, "Team stickers")).slice(1)).toEqual([":kettle-works:Everyone on Kettle Works is in: unlock the sticker on its page", ":lanterns:Collect all 5 people on Lanterns · 4 of 5", ":copper-kite:Collect all 3 people on Copper Kite · 0 of 3"]);
    expect(rowsIn(shelf(popup, "Milestones"))).toEqual([":full-of-friends:Reach gold in Faces in the album · 12 of 25", ":heart-of-the-team:Reach gold in Kind words · 9 of 100"]);
    expect(rowsIn(shelf(popup, "Levels"))[1]).toBe(":level-10:Reach level 10 · 1,210 of 4,500 XP");
    expect(document.querySelectorAll(".al-popover .al-emoji-art[data-locked]")).toHaveLength(6);
    await view.user.click(shelf(popup, "Team stickers").getByRole("link", { name: /Kettle Works/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Kettle Works" })).toBeInTheDocument();
  });

  it("shows the nearest locked emojis of a kind first, then Show all lists the rest, leaving out a team nobody is matched on yet", async () => {
    const nobodyMatched = anEmoji({ id: "team:empty", kind: "team", name: "empty", from: "Empty", progress: { have: 0, need: 0 } });
    const teams = [nobodyMatched, ...Array.from({ length: 6 }, (_, index) => anEmoji({ id: `team:team-${index}`, kind: "team", name: `team-${index}`, from: `Team ${index}`, progress: { have: index, need: 6 } }))];
    const view = visit("/", { album: { ...midway, emojis: teams } });
    const popup = await openTheEmojis(view);
    const teamShelf = shelf(popup, "Team stickers");
    expect(rowsIn(teamShelf).map((row) => row.slice(0, row.indexOf(":", 1) + 1))).toEqual([":team-5:", ":team-4:", ":team-3:"]);

    await view.user.click(teamShelf.getByRole("button", { name: "Show all · 3 more" }));

    expect(rowsIn(teamShelf)).toHaveLength(6);
    expect(teamShelf.getByRole("heading", { level: 3 }).textContent).toBe("Team stickers0 of 6");
    expect(teamShelf.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("a search finds emojis by name, team, milestone or person, and says when none matches", async () => {
    const view = visit("/");
    const popup = await openTheEmojis(view);

    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "ines");

    expect(rowsIn(popup)).toEqual(["IO:ines-okafor-hype:From your first thoughtful pack for Ines Okafor · 9 Oct 2026Add to Slack"]);
    await view.user.clear(popup.getByRole("searchbox", { name: "Find an emoji" }));
    await view.user.type(popup.getByRole("searchbox", { name: "Find an emoji" }), "kind words");
    expect(rowsIn(popup)).toEqual([":heart-of-the-team:Reach gold in Kind words · 9 of 100"]);
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
    expect(within(shelf(popup, "Hype").getByRole("listitem")).getByRole("button", { name: "Add :ines-okafor-hype: to Slack" })).toBeInTheDocument();
  });

  it("Add to Slack on a level emoji downloads its static picture as <name>.png, copies the name and opens the workspace's custom emoji page", async () => {
    const saved = savedDownloads();
    const copied = vi.fn(async () => undefined);
    const view = visit("/");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    const popup = await openTheEmojis(view);
    const levelFive = within(shelf(popup, "Levels").getAllByRole("listitem")[0]!);

    await view.user.click(levelFive.getByRole("button", { name: "Add :level-5: to Slack" }));

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

    await view.user.click(shelf(popup, "Hype").getByRole("button", { name: "Add :ines-okafor-hype: to Slack" }));

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

    await view.user.click(shelf(popup, "Hype").getByRole("button", { name: "Add :ines-okafor-hype: to Slack" }));

    await waitFor(() => expect(saved).toEqual([{ file: "ines-okafor-hype.png", href: "blob:drawn-emoji" }]));
    expect(drawn).toEqual({ images: [facePicture], texts: [] });
  });

  it("without the workspace's Slack address, Add to Slack still saves the picture and says where to add it", async () => {
    const saved = savedDownloads();
    const view = visit("/", { album: { ...midway, emojiPage: null } });
    const popup = await openTheEmojis(view);
    const levelFive = within(shelf(popup, "Levels").getAllByRole("listitem")[0]!);

    await view.user.click(levelFive.getByRole("button", { name: "Add :level-5: to Slack" }));

    await waitFor(() => expect(saved).toEqual([{ file: "level-5.png", href: "/emoji/level-5.png" }]));
    expect(window.open).not.toHaveBeenCalled();
    expect(await levelFive.findByRole("status")).toHaveTextContent("Saved level-5.png. In Slack, add it as :level-5: under Customize workspace, Emoji.");
  });
});

describe("AL26: an earned emoji is marked seen only once its moment has shown", { timeout: 30_000 }, () => {
  const fresh = albumFixtures.newEmojis;

  it("each new emoji pops as a moment with its picture, its name and why it was earned, one at a time, and only taking it sends markEmojisSeen for it", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });

    const moment = await aMoment();

    expect(view.marked).not.toHaveBeenCalled();
    expect(within(moment).getByRole("heading", { level: 2 }).textContent).toBe(":quiet-harbour:");
    expect(moment).toHaveTextContent("You unlocked the Quiet Harbour team sticker · 15 Oct 2026");
    expect(moment).toHaveTextContent("Use it in Slack: react with it and put it in the kudos you give.");
    expect(moment).toHaveTextContent("1 of 4 new");
    await view.user.click(within(moment).getByRole("button", { name: "Add to my emojis" }));

    expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour"]);
    const next = await aMoment();
    await waitFor(() => expect(within(next).getByRole("heading", { level: 2 }).textContent).toBe(":level-5:"));
    expect(next).toHaveTextContent("Add it to Slack from your emojis, then react with it and put it in the kudos you give.");
  });

  it("Skip the rest marks every waiting emoji seen at once and plays no more moments", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });
    const moment = await aMoment();

    await view.user.click(within(moment).getByRole("button", { name: "Skip the rest" }));

    expect(view.marked).toHaveBeenCalledExactlyOnceWith(["team:quiet-harbour", "level:5", "hype:bram-teller", "hype:fen-marlowe"]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));
    expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument();
  });

  it("Escape takes the moment like its button, and a refused or unreachable markEmojisSeen still moves on to the next one", async () => {
    preferReducedMotion();
    const view = visit("/", { album: { ...fresh, emojis: fresh.emojis.filter(({ kind }) => kind !== "hype") }, markEmojisSeen: async () => Promise.reject(new Error("unreachable")) });
    await aMoment();

    await view.user.keyboard("{Escape}");

    const next = await aMoment();
    await waitFor(() => expect(within(next).getByRole("heading", { level: 2 }).textContent).toBe(":level-5:"));
    await view.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument());
    expect(view.marked.mock.calls).toEqual([[["team:quiet-harbour"]], [["level:5"]]]);
  });

  it("a hype emoji waits while its person's pack is still unopened, and an emoji seen before never pops", async () => {
    const waitingFor = midway.packs[0]!.person;
    const album = { ...midway, emojis: [...midway.emojis, anEmoji({ id: `hype:${waitingFor}`, kind: "hype", name: `${waitingFor}-hype`, from: "Juno Park", earned: true, earnedAt: Date.now(), progress: null })] };
    visit("/", { album });

    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));

    expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument();
  });

  it("AL54: no moment plays while a pack opening is open; it waits until the opening closes", async () => {
    preferReducedMotion();
    const view = visit("/", { album: fresh });
    const [bar] = await screen.findAllByRole("banner");
    await view.user.click(within(bar!).getByRole("button", { name: /^Open your packs/ }));
    expect(await screen.findByRole("dialog", { name: /pack/i }, { timeout: 5_000 })).toBeInTheDocument();

    await act(() => new Promise((resolve) => setTimeout(resolve, 1_200)));

    expect(screen.queryByRole("dialog", { name: "New emoji unlocked" })).not.toBeInTheDocument();
    await view.user.keyboard("{Escape}");
    expect(await aMoment()).toBeInTheDocument();
  });
});

describe("#664 AL32: the Settings page shows workspace admins the shared list", { timeout: 30_000 }, () => {
  it("an admin sees every team, milestone and level emoji with its picture, its name, what earns it and whether Slack has it", async () => {
    visit("/settings", { album: albumFixtures.admin });

    const list = within(await screen.findByRole("region", { name: "Shared emojis" }));

    expect(rowsIn(list)).toEqual([
      ":quiet-harbour:The Quiet Harbour team stickerIn Slack",
      ":lanterns:The Lanterns team stickerAdd to Slack",
      ":kettle-works:The Kettle Works team stickerAdd to Slack",
      ":copper-kite:The Copper Kite team stickerAdd to Slack",
      ":full-of-friends:Gold in Faces in the album: Full of friendsAdd to Slack",
      ":heart-of-the-team:Gold in Kind words: Heart of the teamAdd to Slack",
      ":level-5:Reaching level 5Add to Slack",
      ":level-10:Reaching level 10Add to Slack",
    ]);
    expect(list.getByText("1 of 8 in Slack")).toBeInTheDocument();
  });

  it("a member who is no admin sees no shared list", async () => {
    visit("/settings");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Shared emojis" })).not.toBeInTheDocument();
  });
});
