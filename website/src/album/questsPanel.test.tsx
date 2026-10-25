import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album, QuestsRead, QuestsShown } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedPlayerCards } from "./playerCardFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixedQuests, noQuests, questsFixtures } from "./questsFixtures";
import { fixtureWeeks } from "./weekFixtures";

const arrival = { timeout: 10_000 };
const aTeamPage = "/book#teams/lanterns";
const withPageD: Album = { ...albumFixtures.midway, personPageD: true, linkPreviews: true };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  window.localStorage.clear();
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

function visit(address: string, { quests = fixedQuests(questsFixtures.newcomer), album = albumFixtures.midway }: { quests?: QuestsRead; album?: Album } = {}) {
  window.history.replaceState(null, "", address);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), {
    quests,
    playerCards: fixedPlayerCards(),
    weeks: fixtureWeeks(),
    people: fixedPeople(album),
    boards: fixedBoards(boardsFixtures.week),
    profile: fixedProfile(profileFixtures.noted),
    hoggies: fixedHoggies(hoggiesFixtures.glance),
  });
}

async function openPanel() {
  return within(await screen.findByRole("complementary", { name: "Quests" }, arrival));
}

function tab() {
  return screen.getByRole("button", { name: /^Quests,/ });
}

function views(actions: { viewQuests: ReturnType<typeof vi.fn> }) {
  return actions.viewQuests.mock.calls.map(([surface]) => surface);
}

describe("MQ38 MQ39: the quests panel greets a newcomer with the Getting started journey", { timeout: 30_000 }, () => {
  it("opens on a first visit with the eyebrow, the warm title, its note, five steps and the footer", async () => {
    visit(aTeamPage);

    const panel = await openPanel();
    expect(panel.getByText("Getting started · 1 of 5")).toBeInTheDocument();
    expect(panel.getByRole("heading", { name: "Welcome in, Sam" })).toBeInTheDocument();
    expect(panel.getByText("A few small ways to make someone's day. Every quest leaves a face-down hoggie on your board.")).toBeInTheDocument();
    expect(panel.getAllByRole("listitem").map((step) => step.getAttribute("aria-label"))).toEqual([
      "Give your first hug: done",
      "Thank someone and say why: next, +50 XP and a face-down hoggie",
      "Turn the hoggie it left on your board: not yet",
      "Thank someone you haven't thanked before: not yet, +50 XP and a face-down hoggie",
      "Say why on 2 different days: not yet, +50 XP and a face-down hoggie",
    ]);
    expect(panel.getByText("Once these are done, three new quests arrive every Monday.")).toBeInTheDocument();
  });

  it("names the next step with its hint, and shows progress on a step that counts more than one", async () => {
    visit(aTeamPage, { quests: fixedQuests(questsFixtures.halfway) });

    const panel = await openPanel();
    const next = within(panel.getByRole("listitem", { name: /^Thank someone you haven't thanked before: next/ }));
    expect(next.getByText("Next")).toBeInTheDocument();
    expect(next.getByText("Someone from another team counts, and so does a new joiner.")).toBeInTheDocument();
    expect(panel.getByRole("img", { name: "1 of 2" })).toBeInTheDocument();
    expect(panel.getByText("Getting started · 3 of 5")).toBeInTheDocument();
  });

  it("MQ37: a finished step whose hoggie waits offers the board, and one already turned does not", async () => {
    visit(aTeamPage, { quests: fixedQuests(questsFixtures.firstThanks) });

    const panel = await openPanel();
    const finished = within(panel.getByRole("listitem", { name: /^Thank someone and say why: done/ }));
    expect(finished.getByRole("button", { name: "Turn it on your board →" })).toBeInTheDocument();
    expect(panel.getAllByRole("button", { name: "Turn it on your board →" })).toHaveLength(1);
  });

  it("MQ41: records one panel view for the first-visit open", async () => {
    const { actions } = visit(aTeamPage);

    await openPanel();

    await waitFor(() => expect(views(actions)).toEqual(["panel"]));
  });
});

describe("MQ39: the panel folds to a tab, and the fold is remembered", { timeout: 30_000 }, () => {
  it("folds into a tab with its ring and unfolds from it, recording a view for each open", async () => {
    const { actions, user } = visit(aTeamPage);
    const panel = await openPanel();

    await user.click(panel.getByRole("button", { name: "Fold the quests away" }));

    expect(screen.queryByRole("heading", { name: "Welcome in, Sam" })).not.toBeInTheDocument();
    expect(tab()).toHaveAccessibleName("Quests, 1 of 5 done");
    await user.click(tab());
    expect(await openPanel()).toBeTruthy();
    await waitFor(() => expect(views(actions)).toEqual(["panel", "panel"]));
  });

  it("Escape folds it", async () => {
    const { user } = visit(aTeamPage);
    const panel = await openPanel();

    panel.getByRole("button", { name: "Fold the quests away" }).focus();
    await user.keyboard("{Escape}");

    expect(tab()).toBeInTheDocument();
  });

  it("starts folded on the next visit once folded, and records no view until it opens", async () => {
    const first = visit(aTeamPage);
    await first.user.click((await openPanel()).getByRole("button", { name: "Fold the quests away" }));
    first.unmount();

    const { actions } = visit(aTeamPage);

    expect(await screen.findByRole("button", { name: /^Quests,/ }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Quests" })).not.toBeInTheDocument();
    expect(views(actions)).toEqual([]);
  });

  it("starts folded on a phone whatever was remembered, and opens over the page", async () => {
    window.matchMedia = ((query: string) => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { user } = visit(aTeamPage);

    await user.click(await screen.findByRole("button", { name: /^Quests,/ }, arrival));

    expect((await openPanel()).getByRole("heading", { name: "Welcome in, Sam" })).toBeInTheDocument();
  });
});

describe("MQ37 MQ39: after onboarding the panel lists this week's drawn quests", { timeout: 30_000 }, () => {
  it("shows three rows with progress and +20 XP, a finished row crossed off with its board link, and the days left", async () => {
    visit(aTeamPage, { quests: fixedQuests(questsFixtures.week) });

    const panel = await openPanel();
    expect(panel.getByText("This week · 1 of 3")).toBeInTheDocument();
    expect(panel.getByRole("heading", { name: "Your quests this week, Sam" })).toBeInTheDocument();
    expect(panel.getAllByRole("listitem").map((row) => row.getAttribute("aria-label"))).toEqual([
      "Thank someone and say why, 3 times: not yet, +20 XP and a face-down hoggie",
      "Thank 2 people you haven't thanked before: not yet, +20 XP and a face-down hoggie",
      "Thank someone you haven't thanked in the last 30 days: done, won 20 XP and a hoggie",
    ]);
    expect(panel.getByRole("img", { name: "2 of 3" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Turn it on your board →" })).toBeInTheDocument();
    expect(panel.getByText("3 days left · new quests Monday at 9:00")).toBeInTheDocument();
  });
});

describe("MQ38 MQ40: the member's own page D carries the quests section, and the panel steps aside", { timeout: 30_000 }, () => {
  it("shows the section between the card and This week, records a profile view, and the panel shows as its tab", async () => {
    const { actions } = visit("/book#me", { album: withPageD });

    const section = await screen.findByRole("region", { name: "Your quests" }, arrival);
    expect(within(section).getByRole("heading", { name: "Welcome in, Sam" })).toBeInTheDocument();
    expect(within(section).getByText("Once these are done, three new quests arrive every Monday.")).toBeInTheDocument();
    const order = [screen.getByRole("region", { name: "Your card" }), section, screen.getByRole("region", { name: "This week" })];
    expect(order.every((region, index) => index === 0 || order[index - 1]!.compareDocumentPosition(region) === Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(tab()).toBeInTheDocument();
    await waitFor(() => expect(views(actions)).toEqual(["profile"]));
  });

  it("opening the tab on the own page leaves the remembered fold as it was", async () => {
    const first = visit(aTeamPage);
    await first.user.click((await openPanel()).getByRole("button", { name: "Fold the quests away" }));
    first.unmount();
    const own = visit("/book#me", { album: withPageD });
    await screen.findByRole("region", { name: "Your quests" }, arrival);
    await own.user.click(tab());
    expect(await openPanel()).toBeTruthy();
    own.unmount();

    visit(aTeamPage);

    expect(await screen.findByRole("button", { name: /^Quests,/ }, arrival)).toBeInTheDocument();
  });

  it.each(["/book#me/quests", "/book#me/quests/someone-new"])("MQ22: the welcome's link %s lands at the section", async (address) => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    visit(address, { album: withPageD });

    const section = await screen.findByRole("region", { name: "Your quests" }, arrival);

    await waitFor(() => expect(scrolled.mock.contexts).toContain(section));
    expect(section).toHaveFocus();
  });

  it("the plain profile address does not scroll to the section", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    visit("/book#me", { album: withPageD });

    const section = await screen.findByRole("region", { name: "Your quests" }, arrival);

    expect(scrolled.mock.contexts).not.toContain(section);
  });

  it("no section on a teammate's page D", async () => {
    visit("/book#people/milo-strand", { album: withPageD });

    await screen.findByRole("region", { name: /card$/ }, arrival);
    expect(screen.queryByRole("region", { name: "Your quests" })).not.toBeInTheDocument();
  });

  it("the old profile, with page D off, gets no section and no Getting started strip, and the panel opens as on any page", async () => {
    visit("/book#me");

    expect(await openPanel()).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your quests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });
});

describe("MQ42 MQ43: no panel off the path, while loading or when the read fails", { timeout: 30_000 }, () => {
  it.each<[string, QuestsShown | undefined]>([
    ["off the Monday path", { kind: "not-found" }],
    ["while the read is loading", undefined],
    ["when the read fails", { kind: "broken" }],
  ])("%s there is no panel, no tab and no section, and the page works", async (_, answer) => {
    visit("/book#me", { quests: () => answer, album: withPageD });

    expect(await screen.findByRole("region", { name: "Your card" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Quests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your quests" })).not.toBeInTheDocument();
  });

  it("off the Monday path the old profile keeps its Getting started strip", async () => {
    visit("/book#me", { quests: noQuests });

    expect(await screen.findByRole("region", { name: "Getting started" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Quests" })).not.toBeInTheDocument();
  });
});
