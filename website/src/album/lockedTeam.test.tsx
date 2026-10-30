import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album } from "./answer";

const chatUrl = "https://app.slack.com/client/T1";

const withBookNext: Album = { ...albumFixtures.midway, bookNext: { chatUrl, rarityCaps: true } };

const withStickersWaiting: Album = {
  ...withBookNext,
  packs: [{ pack: "pack-ivo", person: "ivo-lark", earnedAt: 0, thanked: { name: "Ivo Lark", face: null } }],
  tray: [{ item: "tray-mara", kind: "sticker", person: "mara-fenn", thanked: { name: "Mara Fenn", face: null } }],
};

const withAnEmptyTeam: Album = {
  ...withBookNext,
  teams: [...withBookNext.teams, { ...withBookNext.teams.find(({ team }) => team === "lanterns")!, team: "soloists", name: "Soloists", mine: false, people: [], unmatched: [], held: 0, total: 0, state: "progress" }],
};

const arrival = { timeout: 10_000 };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

function visit(team: string, album: Album = withBookNext) {
  window.history.replaceState(null, "", `/book#teams/${team}`);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { people: fixedPeople(album) });
}

async function photo() {
  return within(await screen.findByRole("figure", { name: / team photo$/ }, arrival));
}

function progress(team: string) {
  return screen.findByRole("button", { name: new RegExp(`^Unlock the ${team} sticker`) }, arrival);
}

function teamCard(team: string) {
  return screen.getByRole("dialog", { name: `Unlock the ${team} sticker` });
}

function paysOf(dialog: HTMLElement) {
  return within(within(dialog).getByRole("list", { name: "What the sticker pays" }))
    .getAllByRole("listitem")
    .map((chip) => chip.textContent);
}

async function openedTeamCard(team: string, slug: string, album: Album = withBookNext) {
  visit(slug, album);
  await userEvent.click(await progress(team));
  return teamCard(team);
}

describe("HH86: a team page still collecting explains how to complete it", { timeout: 30_000 }, () => {
  it("shows a progress bar under the header that says how many are collected and how many to go", async () => {
    visit("salt-and-sparrow");

    const bar = await progress("Salt and Sparrow");
    expect(bar).toHaveAccessibleDescription("2 of 5 collected · 3 to go");
    expect(screen.getByRole("progressbar", { name: "2 of 5 collected" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("heading", { name: "Salt and Sparrow" }).compareDocumentPosition(bar)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(bar.compareDocumentPosition(screen.getByRole("figure", { name: /team photo$/ }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("opens the team card from the progress bar", async () => {
    visit("salt-and-sparrow");
    const bar = await progress("Salt and Sparrow");

    await userEvent.click(bar);

    expect(teamCard("Salt and Sparrow")).toBeVisible();
    expect(bar).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the team card from the locked sticker, which carries a question mark", async () => {
    visit("salt-and-sparrow");
    const seal = (await photo()).getByRole("button", { name: "Salt and Sparrow sticker, 2 of 5: how to unlock it" });
    expect(seal).toHaveTextContent("?");

    await userEvent.click(seal);

    expect(teamCard("Salt and Sparrow")).toBeInTheDocument();
  });

  it("opens a card for a missing teammate that says what their kudos does for the team", async () => {
    visit("salt-and-sparrow");

    await userEvent.click((await photo()).getByRole("button", { name: "Ivo Lark, not in your album yet: how to get them" }));

    const card = within(screen.getByRole("dialog", { name: "Ivo isn't in your album yet" }));
    expect(card.getByText("Give Ivo a kudos: their sticker joins your album, and the team is 2 more from complete.")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /^Give Ivo a kudos/ })).toHaveAttribute("href", chatUrl);
  });

  it("says the last missing teammate completes the team", async () => {
    visit("paper-moons", { ...withBookNext, packs: [] });

    await userEvent.click((await photo()).getByRole("button", { name: "Rook Dale, not in your album yet: how to get them" }));

    expect(screen.getByRole("dialog", { name: "Rook isn't in your album yet" })).toHaveTextContent("Give Rook a kudos: their sticker joins your album, and the team is complete.");
  });

  it("sends you to a missing teammate's waiting pack or tray card instead of asking for another kudos", async () => {
    visit("salt-and-sparrow", withStickersWaiting);

    await userEvent.click((await photo()).getByRole("button", { name: /^Ivo Lark/ }));
    const ivo = within(screen.getByRole("dialog", { name: "Ivo isn't in your album yet" }));
    expect(ivo.getByText("Ivo's pack is waiting. Open it from your packs to add Ivo to your album.")).toBeInTheDocument();
    expect(ivo.queryByRole("link")).toBeNull();

    await userEvent.click((await photo()).getByRole("button", { name: /^Mara Fenn/ }));
    expect(screen.getByRole("dialog", { name: "Mara isn't in your album yet" })).toHaveTextContent("Mara's card is in your tray. Put it in from the top bar.");
  });

  it("gives a missing teammate's sticker a How to get hint", async () => {
    visit("salt-and-sparrow");

    expect((await photo()).getByRole("button", { name: /^Ivo Lark/ })).toHaveTextContent("How to get");
  });

  it("still links a collected teammate to their person page", async () => {
    visit("salt-and-sparrow");

    expect((await photo()).getByRole("link", { name: "Oren Pike In your album" })).toHaveAttribute("href", "/book#people/oren-pike");
  });

  it("leaves a team nobody can collect yet as it is", async () => {
    visit("soloists", withAnEmptyTeam);

    expect(await screen.findByRole("heading", { name: "Soloists" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unlock the Soloists sticker/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /how to unlock it$/ })).toBeNull();
  });

  it.each([
    ["Kettle Works", "kettle-works"],
    ["Quiet Harbour", "quiet-harbour"],
  ])("leaves the %s page, ready or unlocked, as it is", async (team, slug) => {
    visit(slug);

    await photo();
    expect(screen.queryByRole("button", { name: new RegExp(`^Unlock the ${team} sticker`) })).toBeNull();
    expect(screen.queryByRole("button", { name: /how to get them$/ })).toBeNull();
  });
});

describe("HH87: the team card says who is left and what the sticker pays", { timeout: 30_000 }, () => {
  it("lists who is left, each with a Give a kudos button that opens Slack", async () => {
    const card = within(await openedTeamCard("Salt and Sparrow", "salt-and-sparrow"));

    expect(card.getByText("Give a kudos to every member. 3 people left:")).toBeInTheDocument();
    const giving = card.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
    expect(giving).toEqual([
      [expect.stringMatching(/^Give Ivo a kudos/), chatUrl],
      [expect.stringMatching(/^Give Mara a kudos/), chatUrl],
      [expect.stringMatching(/^Give Teo a kudos/), chatUrl],
    ]);
  });

  it("says whose sticker already waits in a pack or the tray, with no Give a kudos button for them", async () => {
    const card = within(await openedTeamCard("Salt and Sparrow", "salt-and-sparrow", withStickersWaiting));

    expect(card.getAllByRole("listitem").filter((row) => row.closest(".al-give")).map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^.*Ivo Lark.*Pack waiting$/),
      expect.stringMatching(/^.*Mara Fenn.*In your tray$/),
      expect.stringMatching(/Give Teo a kudos/),
    ]);
    expect(card.getAllByRole("link", { name: /^Give / })).toHaveLength(1);
  });

  it("pays a rare hoggie and the team emoji, and no XP, and says only kudos reach epic and legendary", async () => {
    const card = await openedTeamCard("Lanterns", "lanterns");

    expect(paysOf(card)).toEqual(["A rare hoggie", ":team-lanterns:"]);
    expect(card).not.toHaveTextContent(/XP/);
    expect(card).toHaveTextContent("Kudos are the only way to epic and legendary hoggies.");
  });

  it("pays today's floor while rarity-caps is off", async () => {
    const card = await openedTeamCard("Lanterns", "lanterns", { ...withBookNext, bookNext: { chatUrl, rarityCaps: false } });

    expect(paysOf(card)[0]).toBe("A rare hoggie or rarer");
    expect(card).not.toHaveTextContent(/only way/);
  });

  it("names the team emoji by its slug when the album has no emoji for it yet", async () => {
    expect(paysOf(await openedTeamCard("Salt and Sparrow", "salt-and-sparrow"))[1]).toBe(":team-salt-and-sparrow:");
  });

  it("closes on ×", async () => {
    const card = await openedTeamCard("Salt and Sparrow", "salt-and-sparrow");

    await userEvent.click(within(card).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens beside whatever was clicked, one card at a time", async () => {
    visit("salt-and-sparrow");
    await userEvent.click(await progress("Salt and Sparrow"));

    await userEvent.click((await photo()).getByRole("button", { name: /^Mara Fenn/ }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Mara isn't in your album yet" })).toBeInTheDocument();
  });

  it("gives the focus back to what opened it on Escape", async () => {
    visit("salt-and-sparrow");
    const seal = (await photo()).getByRole("button", { name: /how to unlock it$/ });
    await userEvent.click(seal);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(seal).toHaveFocus();
  });
});

describe("HH89: while book-next is off, a team page still collecting is as before", { timeout: 30_000 }, () => {
  it("shows no progress bar and links every teammate to their person page", async () => {
    visit("salt-and-sparrow", albumFixtures.midway);

    const shown = await photo();
    expect(screen.queryByRole("button", { name: /^Unlock the Salt and Sparrow sticker/ })).toBeNull();
    expect(shown.getByRole("link", { name: "Ivo Lark Not in your album yet" })).toHaveAttribute("href", "/book#people/ivo-lark");
    expect(shown.getByRole("img", { name: "Salt and Sparrow sticker, 2 of 5" })).toBeInTheDocument();
  });
});
