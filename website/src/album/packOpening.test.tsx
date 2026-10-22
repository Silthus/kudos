import { Logo } from "@posthog/brand/logo";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, stickerFor } from "./albumFixtures";
import type { Album, AlbumEmoji, AlbumRead, PackOpenReply, TrayItem } from "./answer";

const memberWithTheAlbum = shellFixtures.member;

const bonus = { xp: 15, coins: 0, from: { xp: 1210, level: 6, coins: 0, skillPoints: 0 }, to: { xp: 1225, level: 6, coins: 0, skillPoints: 0 } };

const junoHype: AlbumEmoji = { id: "hype:juno-park", kind: "hype", name: "juno-park-hype", from: "Juno Park", picture: "/emoji/hype-juno-park.png", earned: true, earnedAt: Date.parse("2026-10-17T10:00:00Z"), seen: false, inSlack: false, progress: null };

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
  const answerNext = (next: Album) => {
    answer = next;
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answerNext, now: () => answer };
}

type DroppedHoggie = Omit<Extract<TrayItem, { kind: "hoggie" }>, "item" | "kind">;

function stickerAndHoggie(person: string, hoggie: DroppedHoggie = { hoggie: "banana", rarity: "common", isNew: true }): TrayItem[] {
  return [
    stickerFor(`tray-${person}`, person),
    { item: `tray-${hoggie.hoggie}`, kind: "hoggie", ...hoggie },
  ];
}

function opened(items: TrayItem[], applied: typeof bonus | null = bonus): PackOpenReply {
  return { kind: "opened", items, applied };
}

function afterTheOpen(album: Album, pack: string, items: TrayItem[]): Album {
  return { ...album, packs: album.packs.filter((waiting) => waiting.pack !== pack), tray: [...album.tray, ...items], level: { ...album.level, xp: album.level.xp + 15 } };
}

function visit(album: Album, openThoughtfulPack: (pack: string) => Promise<PackOpenReply>, { readFollows = true }: { readFollows?: boolean } = {}) {
  window.history.replaceState(null, "", "/");
  const live = anAlbumThatAnswers(album);
  const send = vi.fn(async (pack: string) => {
    const reply = await openThoughtfulPack(pack);
    if (reply.kind === "opened" && readFollows) live.answerNext(afterTheOpen(live.now(), pack, reply.items));
    return reply;
  });
  const view = renderAlbum(memberWithTheAlbum, live.read, { commands: { openThoughtfulPack: send } });
  return { ...view, send, live };
}

async function topBar() {
  const [bar] = await screen.findAllByRole("banner");
  return within(bar!);
}

async function openThePacks(user: ReturnType<typeof visit>["user"]) {
  await user.click((await topBar()).getByRole("button", { name: /^Open your packs/ }));
  return within(await screen.findByRole("dialog", { name: "Open your packs" }));
}

const notCompleting: Album = { ...albumFixtures.midway, teams: albumFixtures.midway.teams.map((team) => (team.team === "lanterns" ? { ...team, people: [...team.people, "kai-lumen"], total: 6 } : team)) };

const lastPackNotCompleting: Album = { ...notCompleting, packs: notCompleting.packs.slice(0, 1) };

describe("AL47: the packs button opens the oldest waiting pack, sealed, and only the member's rip opens it", () => {
  it("shows the pack naming whom it thanks, with the waiting count and the next pack, and sends nothing until the rip", async () => {
    const { user, send } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));

    const dialog = await openThePacks(user);

    expect(dialog.getByText("2 packs waiting")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" })).toHaveFocus();
    expect(dialog.getByText("For thanking Juno Park")).toBeInTheDocument();
    expect(within(dialog.getByRole("complementary", { name: "Up next" })).getByRole("button", { name: "Open the pack for thanking Rook Dale" })).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("the rip sends openThoughtfulPack once, for that pack", async () => {
    const { user, send } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);

    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    expect(await dialog.findByText("Two cards inside")).toBeInTheDocument();
    expect(send.mock.calls).toEqual([["pack-1"]]);
  });

  it("a pack names the person it thanks with their stored face, on the wrapper and on their card, though they're on no team page the album lists", async () => {
    const ivo = { name: "Ivo Strand", face: { kind: "slack", image: "https://pictures.example/ivo.png", initials: "IS" } } as const;
    const onNoPage: Album = { ...albumFixtures.midway, packs: [{ pack: "pack-9", person: "ivo-strand", earnedAt: 1, thanked: ivo }] };
    const { user } = visit(onNoPage, async () => opened(stickerAndHoggie("ivo-strand")));
    const dialog = await openThePacks(user);

    expect(dialog.getByText("For thanking Ivo Strand")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Ivo Strand" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    const card = dialog.getByRole("group", { name: "Ivo Strand's card" });
    expect(within(card).getByText("Ivo Strand")).toBeInTheDocument();
    expect(card.querySelector(".al-card-portrait img")).toHaveAttribute("src", ivo.face.image);
    expect(dialog.getByText("Ivo Strand", { selector: ".al-opening-title *" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Open your packs" }).textContent).not.toMatch(/teammate/i);
  });

  it("a person with no stored picture shows their name and initials on their card", async () => {
    const onNoPage: Album = { ...albumFixtures.midway, packs: [{ pack: "pack-9", person: "ivo-strand", earnedAt: 1, thanked: { name: "Ivo Strand", face: { kind: "initials", initials: "IS" } } }] };
    const { user } = visit(onNoPage, async () => opened(stickerAndHoggie("ivo-strand")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Ivo Strand" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    const card = dialog.getByRole("group", { name: "Ivo Strand's card" });
    expect(within(card).getByText("IS")).toBeInTheDocument();
    expect(within(card).getByText("Ivo Strand")).toBeInTheDocument();
  });

  it("only a pack whose read holds no name at all opens for thanking a teammate", async () => {
    const nameless: Album = { ...albumFixtures.midway, packs: [{ pack: "pack-9", person: "someone-unlisted", earnedAt: 1, thanked: { name: null, face: null } }] };
    const { user } = visit(nameless, async () => opened([{ item: "tray-h", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }]));

    const dialog = await openThePacks(user);

    expect(dialog.getByText("For thanking a teammate")).toBeInTheDocument();
  });

  it("Escape before the rip closes and opens nothing", async () => {
    const { user, send } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    await openThePacks(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect((await topBar()).getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveFocus();
  });

  it("the sealed pack never says whether it holds the person's sticker", async () => {
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));

    const dialog = await openThePacks(user);

    expect(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" })).not.toHaveTextContent(/card|sticker/i);
  });

});

describe("AL47: the opening turns one card a beat", () => {
  it("the person's card turns with New in your album, the team bar ticking up and a modest burst of confetti", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    const card = dialog.getByRole("group", { name: "Juno Park's card" });
    expect(card).toHaveAttribute("data-face-up", "");
    expect(within(card).getByText("New in your album")).toBeInTheDocument();
    expect(within(card).getByLabelText("Lanterns, 5 of 6 collected")).toHaveAttribute("data-ticking", "");
    expect(dialog.getByText("Lanterns 4/6 → 5/6")).toBeInTheDocument();
    expect(dialog.getByTestId("confetti")).toHaveAttribute("data-size", "modest");
    expect(dialog.queryByText(/Team complete!/)).not.toBeInTheDocument();
    expect(dialog.getByRole("group", { name: "The hoggie card, face down" })).not.toHaveAttribute("data-face-up");
  });

  it("a sticker that completes its team says Team complete! with the big gold burst", async () => {
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    expect(dialog.getByText("Team complete! · Lanterns")).toBeInTheDocument();
    expect(dialog.getByTestId("confetti")).toHaveAttribute("data-size", "gold");
  });

  it("then the hoggie glows in its rarity's colour before it flips, with its name, rarity, the sparkles a rare one earns and the pack's XP", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park", { hoggie: "coffee-run", rarity: "rare", isNew: true })));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    await user.click(dialog.getByRole("button", { name: "Next card" }));

    expect(dialog.getByRole("group", { name: "The hoggie card, face down" })).toHaveAttribute("data-glow", "rare");
    expect(dialog.getByText("Something rare…")).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Turn the hoggie" }));

    const hoggie = dialog.getByRole("group", { name: "Coffee Run, Rare" });
    expect(hoggie).toHaveAttribute("data-face-up", "");
    expect(within(hoggie).getByText("New in your album")).toBeInTheDocument();
    expect(dialog.getByTestId("sparkles")).toBeInTheDocument();
    expect(dialog.getByText("+15 XP")).toBeInTheDocument();
  });

  it("the glow turns the hoggie by itself", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));
    await user.click(dialog.getByRole("button", { name: "Next card" }));

    expect(await dialog.findByRole("group", { name: "Banana, Common" }, { timeout: 3000 })).toHaveAttribute("data-face-up", "");
    expect(dialog.queryByTestId("sparkles")).not.toBeInTheDocument();
  });

  it("a hoggie already found is a spare, without the ribbon", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park", { hoggie: "banana", rarity: "common", isNew: false })));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    const hoggie = dialog.getByRole("group", { name: "Banana, Common" });
    expect(within(hoggie).queryByText("New in your album")).not.toBeInTheDocument();
    expect(dialog.getByText("Spare")).toBeInTheDocument();
  });

  it("a pack without a sticker holds one card, the hoggie, and no confetti", async () => {
    const { user } = visit(notCompleting, async () => opened([{ item: "tray-h", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }]));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    expect(await dialog.findByText("One card inside")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Turn the card" }));

    expect(dialog.getByRole("group", { name: "The hoggie card, face down" })).toHaveAttribute("data-glow", "common");
    expect(dialog.queryByRole("group", { name: /Juno Park's card/ })).not.toBeInTheDocument();
    expect(dialog.queryByTestId("confetti")).not.toBeInTheDocument();
  });

  it("a first-time person's hype emoji shows under their card as its picture and Slack name alone, outside the card", async () => {
    const { user } = visit({ ...notCompleting, emojis: [...notCompleting.emojis, junoHype] }, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    const hype = dialog.getByRole("img", { name: "Hype emoji :juno-park-hype:" });
    expect(hype.closest(".ph-no-capture")).not.toBeNull();
    expect(hype).toHaveTextContent(/^:juno-park-hype:$/);
    expect(hype.querySelector("img")).toHaveAttribute("src", junoHype.picture);
    expect(within(dialog.getByRole("group", { name: "Juno Park's card" })).queryByText(":juno-park-hype:")).not.toBeInTheDocument();
    expect(dialog.queryByText(/unlocked/)).not.toBeInTheDocument();
  });

  it("#736: with emoji-mapping-in-place on, a member sees the hype emoji Slack hasn't as coming soon, with no Find in Slack", async () => {
    const { user } = visit({ ...notCompleting, emojiWizard: true, emojiInPlace: "member", emojis: [...notCompleting.emojis, junoHype] }, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));
    await user.click(await dialog.findByRole("button", { name: "Next card" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the hoggie" }));

    expect(await dialog.findByText("Coming soon to Slack")).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: /in Slack$/ })).not.toBeInTheDocument();
  });

  it("a pack that holds no sticker shows no hype emoji, even for a person who has one", async () => {
    const { user } = visit({ ...notCompleting, emojis: [...notCompleting.emojis, junoHype] }, async () => opened([{ item: "tray-h", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }]));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    expect(dialog.queryByText(":juno-park-hype:")).not.toBeInTheDocument();
  });
});

describe("#720: a face-down card shows PostHog's playing-card back", () => {
  it("both cards carry the official PostHog logo twice in their middle, the second turned upside down like a court card", async () => {
    const official = render(<Logo layout="stacked" variant="mono" />).container.querySelector("svg")!;
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    for (const name of ["The person card, face down", "The hoggie card, face down"]) {
      const logos = [...(await dialog.findByRole("group", { name })).querySelectorAll(`svg[viewBox="${official.getAttribute("viewBox")}"]`)];

      expect(logos.map((logo) => logo.innerHTML)).toEqual([official.innerHTML, official.innerHTML]);
      expect(logos[0]!.closest('[transform^="rotate(180 "]')).toBeNull();
      expect(logos[1]!.closest('[transform^="rotate(180 "]')).not.toBeNull();
    }
  });
});

describe("AL47: the XP bar counts up by the pack bonus", () => {
  it("holds at the XP before the open while the cards turn, then counts up to the album's XP once the hoggie turns", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Turn the first card" }));

    expect((await topBar()).getByText("290 XP to level 7")).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Skip" }));

    expect(await (await topBar()).findByText("275 XP to level 7", undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});

describe("AL47: the opened cards fly into the top bar's tray", () => {
  it("#127: Done flies them up, the tray counting them only once they land, and with the last pack opened gives focus to the tray", async () => {
    const { user } = visit(albumFixtures.onePack, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    expect((await topBar()).getByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("dialog", { name: "Open your packs" })).toHaveAttribute("data-step", "flying");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument(), { timeout: 2000 });
    expect((await topBar()).queryByRole("button", { name: /packs/i })).not.toBeInTheDocument();
    expect((await topBar()).getByRole("button", { name: "Tray, 2 to put in" })).toHaveFocus();
  });

  it("#127: closing with packs still waiting gives focus back to the packs button", async () => {
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    await openThePacks(user);

    await user.click(screen.getByRole("button", { name: "Close the pack opening" }));

    expect((await topBar()).getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveFocus();
  });

  it("Open next pack flies these up and brings the next pack, sealed", async () => {
    const { user, send } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    await user.click(dialog.getByRole("button", { name: "Open next pack · 1 left" }));

    expect(await dialog.findByRole("button", { name: "Rip open the pack for thanking Rook Dale" }, { timeout: 2000 })).toHaveFocus();
    expect(dialog.getByText("1 opened · 1 pack waiting")).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("AL8: a pack opened before getAlbum answers again is never offered again", () => {
  it("reopening the packs while the read still lists the opened pack brings the next one, and counts only it", async () => {
    preferReducedMotion();
    const { user, send } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")), { readFollows: false });
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Done for now" }));

    const again = await openThePacks(user);

    expect(again.getByRole("button", { name: "Rip open the pack for thanking Rook Dale" })).toHaveFocus();
    expect(again.getByText("1 pack waiting")).toBeInTheDocument();
    expect(send.mock.calls).toEqual([["pack-1"]]);
  });

  it("the packs button stops counting a pack the moment it opens", async () => {
    preferReducedMotion();
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")), { readFollows: false });
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Done for now" }));

    expect((await topBar()).getByRole("button", { name: "Open your packs, 1 waiting" })).toHaveFocus();
  });
});

describe("AL55: focus stays inside the pack opening", () => {
  it("Shift+Tab from the first control goes to the last, and Tab from the last back to the first", async () => {
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    const close = dialog.getByRole("button", { name: "Close the pack opening" });
    const next = dialog.getByRole("button", { name: "Open the pack for thanking Rook Dale" });

    close.focus();
    await user.tab({ shift: true });
    expect(next).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
  });

  it("while the cards fly and every control waits, the dialog itself holds focus", async () => {
    const { user } = visit(albumFixtures.midway, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    await user.click(dialog.getByRole("button", { name: "Open next pack · 1 left" }));

    expect(screen.getByRole("dialog", { name: "Open your packs" })).toHaveAttribute("data-step", "flying");
    expect(screen.getByRole("dialog", { name: "Open your packs" })).toHaveFocus();
  });
});

describe("VA27: a click turns one beat, and Escape or Skip jumps to the end", () => {
  it("Escape during the turns shows every card face up, and Escape at the end closes", async () => {
    const { user } = visit(lastPackNotCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await dialog.findByText("Two cards inside");

    await user.keyboard("{Escape}");

    expect(dialog.getByRole("group", { name: "Juno Park's card" })).toHaveAttribute("data-face-up", "");
    expect(dialog.getByRole("group", { name: "Banana, Common" })).toHaveAttribute("data-face-up", "");
    expect(dialog.getByRole("button", { name: "Done" })).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument(), { timeout: 2000 });
  });

  it("says what the pack held in a live region", async () => {
    const { user } = visit(notCompleting, async () => opened(stickerAndHoggie("juno-park")));
    const dialog = await openThePacks(user);
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    await user.click(await dialog.findByRole("button", { name: "Skip" }));

    expect(dialog.getByRole("status")).toHaveTextContent("You opened the pack for thanking Juno Park: Juno Park's card, new in your album, and Banana, Common, new. +15 XP.");
  });
});

describe("AL55: with reduced motion the opening shows its end state at once", () => {
  it("the rip turns every card face up, with no confetti, sparkles, ring, shine or flight", async () => {
    preferReducedMotion();
    const { user } = visit({ ...albumFixtures.onePack }, async () => opened(stickerAndHoggie("juno-park", { hoggie: "coffee-run", rarity: "rare", isNew: true })));
    const dialog = await openThePacks(user);

    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    expect(await dialog.findByRole("group", { name: "Juno Park's card" })).toHaveAttribute("data-face-up", "");
    expect(dialog.getByRole("group", { name: "Coffee Run, Rare" })).toHaveAttribute("data-face-up", "");
    expect(dialog.getByText("Team complete! · Lanterns")).toBeInTheDocument();
    for (const flourish of ["confetti", "sparkles", "ring", "shine"]) expect(dialog.queryByTestId(flourish)).not.toBeInTheDocument();
    expect((await topBar()).getByText("275 XP to level 7")).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument();
    expect((await topBar()).getByRole("button", { name: "Tray, 2 to put in" })).toBeInTheDocument();
  });
});

describe("AL8: a pack the command refuses stays sealed and says why", () => {
  it("a refusal says the pack is already open or can't open, and nothing turns", async () => {
    const { user } = visit(albumFixtures.midway, async () => ({ kind: "refused" }));
    const dialog = await openThePacks(user);

    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("This pack can't be opened. It may already be open on another device.");
    expect(dialog.queryByText("Two cards inside")).not.toBeInTheDocument();
  });

  it("an unreachable server says so and lets the member rip again", async () => {
    let tries = 0;
    const { user, send } = visit(albumFixtures.midway, async () => {
      tries += 1;
      if (tries === 1) throw new Error("HedgeHug didn't answer in time.");
      return opened(stickerAndHoggie("juno-park"));
    });
    const dialog = await openThePacks(user);

    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("Can't reach HedgeHug. Try again.");

    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    expect(await dialog.findByText("Two cards inside")).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
