import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople, fixturePersonOf, fixtureUnlockOf } from "./albumFixtures";
import type { Album, AlbumEmoji, PersonPage, PersonRead, PutAllInReply, UnlockReply } from "./answer";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

const midway = albumFixtures.midway;

const kettleWorksEmoji: AlbumEmoji = { id: "team:kettle-works", kind: "team", name: "kettle-works", picture: "/emoji/team-kettle-works.png", earned: false, seen: false, inSlack: true, progress: { have: 3, need: 3 } };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
});

type Visit = { album?: Album; unlockTeamSticker?: (team: string) => Promise<UnlockReply>; putAllIn?: () => Promise<PutAllInReply>; people?: PersonRead };

function visit(path: string, { album = midway, unlockTeamSticker = async (team) => fixtureUnlockOf(album, team), putAllIn, people = fixedPeople(album) }: Visit = {}) {
  window.history.replaceState(null, "", path);
  const send = vi.fn(unlockTeamSticker);
  const view = renderAlbum(memberWithTheAlbum, fixedAlbum(album), { people, commands: { unlockTeamSticker: send, ...(putAllIn && { putAllIn }) } });
  return { ...view, send };
}

const answersNever = () => new Promise<never>(() => undefined);

async function photo() {
  return within(await screen.findByRole("figure", { name: /^Left to right/ }));
}

async function goal() {
  return within(await screen.findByRole("region", { name: /Collect the whole team|Ready to unlock|Unlocked/ }));
}

function withTheTray(album: Album, person: string): Album {
  return { ...album, tray: [{ item: `tray-${person}`, kind: "sticker", person }] };
}

describe("AL45: the team page is the team's class photo", () => {
  it("the member's own team page is one mounted photo: collected people by face, the rest as silhouettes, the unmatched shown and never counted, and a Left to right caption in the same order", async () => {
    visit("/book#teams/lanterns");

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
    const shown = await photo();
    expect(shown.getAllByRole("listitem").map((person) => person.textContent)).toEqual([
      "IOInes Okafor In your album",
      "BTBram Teller In your album",
      "OVOona Vasquez In your album",
      "TRTomas Reyne In your album",
      "JPJuno Park Not in your album yet",
      "HCHal Corwin Not in Slack yet",
    ]);
    expect(shown.getByRole("link", { name: "Juno Park Not in your album yet" })).toHaveAttribute("href", "/book#people/juno-park");
    expect(shown.queryByRole("link", { name: /Hal Corwin/ })).not.toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Left to right Ines Okafor, Bram Teller, Oona Vasquez, Tomas Reyne, Juno Park, Hal Corwin" })).toBeInTheDocument();
  });

  it("the seal is ringed by one segment per person to collect, filled for each one in the album", async () => {
    visit("/book#teams/lanterns");

    const seal = await screen.findByRole("img", { name: "Lanterns sticker, 4 of 5" });
    expect(seal.querySelectorAll("[data-segment]")).toHaveLength(5);
    expect(seal.querySelectorAll("[data-segment='in']")).toHaveLength(4);
  });

  it("another team's page says it is a team page", async () => {
    visit("/book#teams/tin-orchard");

    expect(await screen.findByRole("heading", { level: 1, name: "Tin Orchard" })).toBeInTheDocument();
    expect(screen.getByText("Team page")).toBeInTheDocument();
  });

  it("a team the album doesn't hold is not found", async () => {
    visit("/book#teams/nowhere-at-all");

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});

describe("AL45: Collect the whole team names the one next step", () => {
  it.each([
    { path: "/book#teams/lanterns", album: midway, step: "Open Juno's pack to complete Lanterns." },
    { path: "/book#teams/lanterns", album: withTheTray(midway, "juno-park"), step: "Juno is in your tray: put the card in to complete Lanterns." },
    { path: "/book#teams/tin-orchard", album: midway, step: "Give Cass a thoughtful kudos to complete Tin Orchard." },
    { path: "/book#teams/salt-and-sparrow", album: midway, step: "Give Ivo, Mara and Teo a thoughtful kudos to complete Salt and Sparrow." },
    { path: "/book#teams/copper-kite", album: midway, step: "Give anyone on Copper Kite a thoughtful kudos to start this page." },
  ])("$step", async ({ path, album, step }) => {
    visit(path, { album });

    const section = await goal();
    expect(section.getByRole("heading", { name: "Collect the whole team" })).toBeInTheDocument();
    expect(section.getByText(step)).toBeInTheDocument();
    expect(section.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a page with four or more still to collect names two and counts the rest", async () => {
    const lanterns = midway.teams.find(({ team }) => team === "lanterns")!;
    const four = { ...lanterns, held: 1 };
    const album: Album = { ...midway, packs: [], teams: midway.teams.map((team) => (team.team === "lanterns" ? four : team)), people: midway.people.map((person) => (person.teams.includes("lanterns") && person.person !== "ines-okafor" ? { ...person, held: false } : person)) };
    visit("/book#teams/lanterns", { album });

    expect((await goal()).getByText("Give Bram, Oona and 2 more a thoughtful kudos to complete Lanterns.")).toBeInTheDocument();
  });


  it("the grey sticker carries a Ready to unlock ribbon, and the page asks to unlock it", async () => {
    visit("/book#teams/kettle-works");

    expect(await screen.findByRole("img", { name: "Kettle Works sticker, ready to unlock" })).toHaveTextContent("Ready to unlock");
    const section = await goal();
    expect(section.getByText("3 of 3 in your album. Everyone is in.")).toBeInTheDocument();
    expect(section.getByRole("button", { name: "Unlock the Kettle Works sticker" })).toBeEnabled();
  });
});

describe("AL45: a team sticker unlocks only on the member's own click", () => {
  it("visiting a ready page sends nothing, and one click sends unlockTeamSticker once for that team however often it is pressed", async () => {
    preferReducedMotion();
    let answer: (reply: UnlockReply) => void = () => undefined;
    const { send } = visit("/book#teams/kettle-works", { unlockTeamSticker: () => new Promise((resolve) => (answer = resolve)) });
    const unlock = (await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" });
    expect(send).not.toHaveBeenCalled();

    await userEvent.click(unlock);
    await userEvent.click(unlock);

    expect(send).toHaveBeenCalledExactlyOnceWith("kettle-works");
    expect(unlock).toHaveAccessibleName("Unlocking…");
    expect(unlock).toHaveAttribute("aria-disabled", "true");
    expect(unlock).toHaveFocus();
    await act(async () => answer(fixtureUnlockOf(midway, "kettle-works")));
    expect(await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" })).toBeInTheDocument();
  });

  it("a refusal says so beside the action and plays no moment", async () => {
    visit("/book#teams/kettle-works", { unlockTeamSticker: async () => ({ kind: "refused" }) });

    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));

    expect(await (await goal()).findByRole("status")).toHaveTextContent("The Kettle Works sticker couldn't be unlocked. Reload the page to see where it stands.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("an unreachable server says so and the action stays to try again", async () => {
    visit("/book#teams/kettle-works", { unlockTeamSticker: async () => Promise.reject(new Error("no answer within 10 s")) });

    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));

    expect(await (await goal()).findByRole("status")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" })).not.toHaveAttribute("aria-disabled");
  });

  it("AL54: while Put them all in waits for its answer and while its cards fly in, the action says it waits and sends nothing, then comes back once they land", async () => {
    const trayed: Album = { ...midway, tray: [{ item: "tray-juno", kind: "sticker", person: "juno-park" }, { item: "tray-banana", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }] };
    let answer: (reply: PutAllInReply) => void = () => undefined;
    const { user, send } = visit("/book#teams/kettle-works", { album: trayed, putAllIn: () => new Promise((resolve) => (answer = resolve)) });
    await user.click(await screen.findByRole("button", { name: /^Tray/ }));
    await user.click(screen.getByRole("button", { name: /^Put them all in/ }));

    const waiting = (await goal()).getByRole("button", { name: "Waiting for your cards to land…" });
    expect(waiting).toHaveAttribute("aria-disabled", "true");
    await user.click(waiting);
    await act(async () => answer({ kind: "placed", items: trayed.tray, more: false }));
    await user.click((await goal()).getByRole("button", { name: "Waiting for your cards to land…" }));
    expect(send).not.toHaveBeenCalled();

    const unlock = await (await goal()).findByRole("button", { name: "Unlock the Kettle Works sticker" }, { timeout: 5_000 });
    expect(unlock).not.toHaveAttribute("aria-disabled");
  });

  it("AL54: while the unlock waits for its answer, the packs button opens nothing, so the moment never lands on a pack", async () => {
    let answer: (reply: UnlockReply) => void = () => undefined;
    const { user } = visit("/book#teams/kettle-works", { unlockTeamSticker: () => new Promise((resolve) => (answer = resolve)) });
    await user.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));

    const [bar] = screen.getAllByRole("banner", { hidden: true });
    expect(bar).toHaveAttribute("inert");
    await act(async () => answer(fixtureUnlockOf(midway, "kettle-works")));
    expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" })).toBeInTheDocument();
  });

  it("a refusal said beside the action goes once getAlbum reads the page unlocked, as when another tab unlocked it first", async () => {
    const live = { album: midway, listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/book#teams/kettle-works");
    renderAlbum(memberWithTheAlbum, read, { people: fixedPeople(midway), commands: { unlockTeamSticker: async () => ({ kind: "refused" }) } });
    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));
    expect(await (await goal()).findByRole("status")).toHaveTextContent(/couldn't be unlocked/);

    live.album = { ...midway, teams: midway.teams.map((team) => (team.team === "kettle-works" ? { ...team, state: "unlocked", unlockedAt: Date.parse("2026-10-18T10:00:00Z") } : team)) };
    act(() => live.listeners.forEach((listener) => listener()));

    expect((await goal()).getByRole("status")).toHaveTextContent("");
  });

  it("dims the page, lifts the sticker, colours it, names it and its team emoji, then flies it back to an unlocked page, in about five seconds", async () => {
    visit("/book#teams/kettle-works", { album: { ...midway, emojis: [...midway.emojis, kettleWorksEmoji] } });
    const unlock = (await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" });
    vi.useFakeTimers();
    await act(async () => fireEvent.click(unlock));
    const moment = screen.getByRole("dialog", { name: "Kettle Works sticker unlocked" });

    expect(moment).toHaveAttribute("data-phase", "lift");
    await act(async () => vi.advanceTimersByTime(1000));
    expect(moment).toHaveAttribute("data-phase", "reveal");
    expect(within(moment).queryByText(":kettle-works:")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(2100));
    expect(moment).toHaveAttribute("data-phase", "named");
    expect(within(moment).getByRole("heading", { name: "Kettle Works sticker unlocked" })).toBeInTheDocument();
    expect(within(moment).getByText("18 Oct 2026 · 3 of 3 people collected")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(800));
    expect(moment).toHaveAttribute("data-phase", "emoji");
    expect(within(moment).getByText(":kettle-works:")).toBeInTheDocument();
    expect(within(moment).getByText("New team emoji · use it in Slack: react with it or put it in a kudos")).toBeInTheDocument();
    expect(within(moment).getByRole("button", { name: "Put it on the page" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(moment).toHaveAttribute("data-phase", "home");
    await act(async () => vi.advanceTimersByTime(820));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Kettle Works sticker, unlocked" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unlocked 18 Oct 2026" })).toHaveFocus();
  });

  it("under reduced motion it shows its end state at once: the coloured sticker, its name, its emoji and the way back, with no lift and no confetti", async () => {
    preferReducedMotion();
    visit("/book#teams/kettle-works");

    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));

    const moment = await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" });
    expect(moment).toHaveAttribute("data-phase", "emoji");
    expect(moment).toHaveAttribute("data-reduced");
    expect(moment.querySelector("[data-confetti]")).toBeNull();
    expect(within(moment).getByText(":kettle-works:")).toBeInTheDocument();
    expect(within(moment).getByText("New team emoji")).toBeInTheDocument();
    await userEvent.click(within(moment).getByRole("button", { name: "Put it on the page" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AL54: while it plays nothing else can start: the top bar and the page are inert, so no pack opens over it", async () => {
    preferReducedMotion();
    visit("/book#teams/kettle-works");

    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));
    await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" });

    const [bar] = screen.getAllByRole("banner", { hidden: true });
    expect(bar).toHaveAttribute("inert");
    expect(screen.getByRole("main", { hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("the page keeps the unlocked sticker the command answered while getAlbum still says ready", async () => {
    preferReducedMotion();
    visit("/book#teams/kettle-works");

    await userEvent.click((await goal()).getByRole("button", { name: "Unlock the Kettle Works sticker" }));
    await userEvent.click(await screen.findByRole("button", { name: "Put it on the page" }));

    expect(await screen.findByRole("img", { name: "Kettle Works sticker, unlocked" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock the Kettle Works sticker" })).not.toBeInTheDocument();
  });
});

describe("AL45: an unlocked page", () => {
  it("shows the gold sticker with its date and its team emoji", async () => {
    visit("/book#teams/quiet-harbour");

    expect(await screen.findByRole("img", { name: "Quiet Harbour sticker, unlocked" })).toBeInTheDocument();
    const section = await goal();
    expect(section.getByRole("heading", { name: "Unlocked 15 Oct 2026" })).toBeInTheDocument();
    expect(section.getByText("The Quiet Harbour sticker is yours.")).toBeInTheDocument();
    expect(section.getByText(":quiet-harbour:")).toBeInTheDocument();
    expect(section.getByText(/is your team emoji\. Use it in Slack: react with it or put it in a kudos\./)).toBeInTheDocument();
  });
});

describe("AL46: the person page", () => {
  it("shows your history with them, their teams and their hype emoji", async () => {
    visit("/book#people/ines-okafor");

    expect(await screen.findByRole("heading", { level: 1, name: "Ines Okafor" })).toBeInTheDocument();
    const history = within(screen.getByRole("list", { name: "Your history together" }));
    expect(history.getAllByRole("listitem").map((fact) => fact.textContent)).toEqual(["First thanked8 Sept 2026", "Kudos you gave1", "Kudos they gave you0", "Hugs you gave0", "Hugs they gave you2"]);
    expect(screen.getByText(/Thanks for staying late to untangle the migration/)).toBeInTheDocument();
    expect(screen.getByText(/^Your best message to/).closest("figcaption")).toHaveTextContent("Your best message to Ines");
    expect(within(screen.getByRole("list", { name: "Their teams" }))
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Kettle Works3 of 3", "/book#teams/kettle-works"],
      ["Lanterns4 of 5", "/book#teams/lanterns"],
    ]);
    expect(screen.getByText(":ines-okafor-hype:")).toBeInTheDocument();
    expect(screen.getByText("Unlocked by your first thoughtful kudos to Ines")).toBeInTheDocument();
  });

  it("someone not in your album yet stands as a silhouette, with how to collect them and how to unlock their hype emoji", async () => {
    visit("/book#people/juno-park");

    expect(await screen.findByRole("heading", { level: 1, name: "Juno Park" })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Not in your album yet" })).toBeInTheDocument();
    expect(screen.getByText("Juno's pack is waiting. Open it from your packs to add Juno to your album.")).toBeInTheDocument();
    expect(screen.getByText("Give Juno a thoughtful kudos to unlock their hype emoji")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Your history together" })).getByText("Not yet")).toBeInTheDocument();
  });

  it("a hype emoji earned before the card is put in already shows their face", async () => {
    const face = { kind: "slack", image: "https://avatars.slack-edge.com/juno.png", initials: "JP" } as const;
    visit("/book#people/juno-park", { people: (asking, person) => (asking && person !== null ? { ...(fixturePersonOf(midway, person) as PersonPage), face, hype: { earned: true, name: "juno-park-hype" } } : undefined) });

    const hype = (await screen.findByText(":juno-park-hype:")).closest("div")!;
    expect(hype.querySelector("img")).toHaveAttribute("src", face.image);
    expect(screen.getByRole("figure", { name: "Not in your album yet" }).querySelector("img")).toBeNull();
  });

  it("someone in the tray, or with nothing waiting, is told the step that adds them", async () => {
    visit("/book#people/juno-park", { album: withTheTray(midway, "juno-park") });
    expect(await screen.findByText("Juno's card is in your tray. Put it in from the top bar.")).toBeInTheDocument();
  });

  it("asks getAlbumPerson for the person in the address only, and a person it doesn't know is not found", async () => {
    const asked: (string | null)[] = [];
    visit("/book#people/nobody-at-all", {
      people: (asking, person) => {
        if (asking) asked.push(person);
        return asking ? { kind: "no-person" } : undefined;
      },
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(new Set(asked)).toEqual(new Set(["nobody-at-all"]));
  });

  it("a team page never asks for a person", async () => {
    const asked: boolean[] = [];
    visit("/book#teams/lanterns", {
      people: (asking) => {
        asked.push(asking);
        return undefined;
      },
    });

    await screen.findByRole("heading", { level: 1, name: "Lanterns" });
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    expect(asked.every((asking) => !asking)).toBe(true);
  });
});
