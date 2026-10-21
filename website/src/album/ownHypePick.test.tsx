import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnHypePick } from "../../../convex/album/emojiMappings";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixturePersonOf } from "./albumFixtures";
import type { PersonPage, PersonRead } from "./answer";

const midway = albumFixtures.midway;
const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;

const ownPage: PersonPage = { ...(fixturePersonOf(midway, "ines-okafor") as PersonPage), person: midway.me.person, name: midway.me.name, face: midway.me.face, hype: { earned: false, name: "sam-example-hype", picture: null, inSlack: false } };

const slackEmojis: SlackEmojiMatchesRead = () => ({
  kind: "matches",
  matches: [
    { name: "sam-wave", image: slackPicture("sam-wave"), free: true },
    { name: "team-lanterns", image: slackPicture("team-lanterns"), free: false },
  ],
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pages(own: PersonPage): PersonRead {
  return (asking, person) => {
    if (!asking || person === null) return undefined;
    return person === own.person ? own : fixturePersonOf(midway, person);
  };
}

const onlyInUse: SlackEmojiMatchesRead = () => ({ kind: "matches", matches: [{ name: "team-lanterns", image: slackPicture("team-lanterns"), free: false }] });

type Visit = { own?: PersonPage; pickMyHypeEmoji?: (emoji: string) => Promise<OwnHypePick>; slackEmojiMatches?: SlackEmojiMatchesRead };

function visit(path: string, { own = { ...ownPage, hypePick: true }, pickMyHypeEmoji = async (): Promise<OwnHypePick> => ({ kind: "picked" }), slackEmojiMatches = slackEmojis }: Visit = {}) {
  window.history.replaceState(null, "", path);
  const pick = vi.fn(pickMyHypeEmoji);
  renderAlbum(shellFixtures.member, fixedAlbum(midway), { people: pages(own), slackEmojiMatches, commands: { pickMyHypeEmoji: pick } });
  return pick;
}

async function openThePicker(name = "Pick your hype emoji") {
  await userEvent.click(await screen.findByRole("button", { name }, { timeout: 10_000 }));
  return within(screen.getByRole("dialog", { name: /your hype emoji in Slack/ }));
}

describe("a member picks their own hype emoji on their own page", { timeout: 30_000 }, () => {
  it("on their own page, a member picks a Slack emoji as their hype emoji and is told it is theirs now", async () => {
    const pick = visit("/book#people/sam-example");

    const picker = await openThePicker();
    expect(picker.getByRole("heading", { name: "Find your hype emoji in Slack" })).toBeInTheDocument();
    await userEvent.click(picker.getByRole("button", { name: "Map to :sam-wave:" }));

    expect(await picker.findByRole("status")).toHaveTextContent("Done. :sam-wave: is your hype emoji in Slack now.");
    expect(pick).toHaveBeenCalledExactlyOnceWith("sam-wave");
  });

  it("a hype emoji already in Slack is changed the same way", async () => {
    visit("/book#people/sam-example", { own: { ...ownPage, hypePick: true, hype: { ...ownPage.hype, inSlack: true } } });

    const picker = await openThePicker("Change your hype emoji");
    expect(picker.getByRole("heading", { name: "Change your hype emoji in Slack" })).toBeInTheDocument();
  });

  it("an emoji mapped elsewhere is refused, and the member is told why", async () => {
    const pick = visit("/book#people/sam-example", { pickMyHypeEmoji: async () => ({ kind: "taken", by: "team" }) });

    const picker = await openThePicker();
    await userEvent.click(picker.getByRole("button", { name: "Map to :team-lanterns:, in use" }));

    expect(await picker.findByRole("alert")).toHaveTextContent("That one is already a team's emoji. Pick another one.");
    expect(pick).toHaveBeenCalledExactlyOnceWith("team-lanterns");
  });

  it.each([
    ["milestone", "That one is already a medal's emoji. Pick another one."],
    ["level", "That one is already a level's emoji. Pick another one."],
    ["random", "That one is already a random drop. Pick another one."],
    ["hype", "That one is already someone else's hype emoji. Pick another one."],
    ["unmapped", "That one is already held back by an admin. Pick another one."],
  ] as const)("an emoji that is a %s's is refused with what holds it", async (by, said) => {
    visit("/book#people/sam-example", { pickMyHypeEmoji: async () => ({ kind: "taken", by }) });

    const picker = await openThePicker();
    await userEvent.click(picker.getByRole("button", { name: "Map to :team-lanterns:, in use" }));

    expect(await picker.findByRole("alert")).toHaveTextContent(said);
  });

  it("when every Slack emoji found is in use, the member is offered to add their own to Slack", async () => {
    visit("/book#people/sam-example", { slackEmojiMatches: onlyInUse });

    const picker = await openThePicker();

    expect(picker.getByText("Every Slack emoji found is in use. Add this one to Slack under its name.")).toBeInTheDocument();
  });

  it("on anyone else's page there is no picker", async () => {
    visit("/book#people/ines-okafor");

    expect(await screen.findByRole("heading", { level: 1, name: "Ines Okafor" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /your hype emoji/ })).not.toBeInTheDocument();
  });

  it("with own-hype-pick off, the member's own page offers no picker", async () => {
    visit("/book#people/sam-example", { own: ownPage });

    expect(await screen.findByRole("heading", { level: 1, name: "Sam Example" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(":sam-example-hype:")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /your hype emoji/ })).not.toBeInTheDocument();
  });
});
