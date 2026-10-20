import { act, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEmoji, AppEmojis } from "../../../convex/website/emojiWizard";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "../emojiWizardReads";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type EmojiPlaceChoice } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album } from "./answer";

const memberWithTheAlbum = shellFixtures.member;

const withTheWizard: Album = { ...albumFixtures.midway, emojiWizard: true };

const arrival = { timeout: 10_000 };

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;

const nearInes = [
  { name: "ines-cheer", image: slackPicture("ines-cheer"), free: true },
  { name: "ines", image: slackPicture("ines"), free: true },
  { name: "ines-old", image: slackPicture("ines-old"), free: false },
];

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  vi.spyOn(window, "open").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Asked = { near: string; search: string }[];

function slackEmojisFor(found: (near: string, search: string) => typeof nearInes, asked: Asked = []): SlackEmojiMatchesRead {
  return (near, search) => {
    asked.push({ near, search });
    return { kind: "matches", matches: found(near, search) };
  };
}

type Visit = { album?: Album; path?: string; found?: (near: string, search: string) => typeof nearInes; mapMyEmoji?: (emoji: string, to: string) => Promise<{ kind: "mapped" } | { kind: "refused" }>; appEmojis?: AppEmojisRead; mapSlackEmoji?: (emoji: string, to: EmojiPlaceChoice) => Promise<{ kind: "mapped" } | { kind: "refused" }> };

function visit({ album = withTheWizard, path = "/", found = () => nearInes, mapMyEmoji = async () => ({ kind: "mapped" }), appEmojis, mapSlackEmoji = async () => ({ kind: "mapped" }) }: Visit = {}) {
  window.history.replaceState(null, "", path);
  const asked: Asked = [];
  const view = renderAlbum(memberWithTheAlbum, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.forTheMaintainer), slackEmojiMatches: slackEmojisFor(found, asked), appEmojis, people: fixedPeople(album), commands: { mapMyEmoji, mapSlackEmoji } });
  return { ...view, asked };
}

async function openTheEmojis(view: ReturnType<typeof visit>) {
  const [bar] = await screen.findAllByRole("banner", {}, arrival);
  await view.user.click(within(bar!).getByRole("button", { name: /^Your emojis/ }));
  return within(screen.getByRole("region", { name: "Your emojis" }));
}

async function theWizard(name: string) {
  return within(await screen.findByRole("dialog", { name: `Find :${name}: in Slack` }, arrival));
}

function matchesIn(wizard: ReturnType<typeof within>): string[] {
  return within(wizard.getByRole("list", { name: "Slack emojis" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "");
}

describe("#719: with emoji-wizard on, a member finds an earned emoji in Slack instead of adding it", { timeout: 30_000 }, () => {
  it("an earned emoji Slack doesn't have offers Find in Slack, never Add to Slack, in the emoji popup, on the team page and on Milestones", async () => {
    const view = visit();
    const popup = await openTheEmojis(view);

    expect(popup.getByRole("button", { name: "Find :ines-okafor-hype: in Slack" })).toHaveTextContent("Find in Slack");
    expect(popup.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
    view.unmount();

    const album = { ...withTheWizard, emojis: withTheWizard.emojis.map((emoji) => (emoji.id === "team:quiet-harbour" ? { ...emoji, inSlack: false } : emoji)) };
    const onTheTeam = visit({ album, path: "/book#teams/quiet-harbour" });
    expect(await screen.findByRole("button", { name: "Find :team-quiet-harbour: in Slack" }, arrival)).toBeInTheDocument();
    expect(screen.getByText(/team emoji\./)).toHaveTextContent("You got the :team-quiet-harbour: team emoji. It isn't in Slack yet: find it in Slack, then react with it and put it in the kudos you give.");
    expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
    onTheTeam.unmount();

    visit({ path: "/book#milestones" });
    expect(await screen.findByRole("button", { name: "Find :familiar-faces: in Slack" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("the wizard suggests the Slack emojis closest to the earned emoji's name, and one click maps it, so it says it is in Slack", async () => {
    const mapMyEmoji = vi.fn(async () => ({ kind: "mapped" }) as const);
    const view = visit({ mapMyEmoji });
    const popup = await openTheEmojis(view);

    await view.user.click(popup.getByRole("button", { name: "Find :ines-okafor-hype: in Slack" }));
    const wizard = await theWizard("ines-okafor-hype");

    expect(view.asked.at(-1)).toEqual({ near: "ines-okafor-hype", search: "" });
    expect(matchesIn(wizard)).toEqual(["Map to :ines-cheer:", "Map to :ines:", "Map to :ines-old:, in use"]);
    expect(wizard.getByRole("button", { name: "Map to :ines-old:, in use" })).toBeDisabled();
    expect(wizard.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();

    await view.user.click(wizard.getByRole("button", { name: "Map to :ines-cheer:" }));

    expect(mapMyEmoji).toHaveBeenCalledExactlyOnceWith("hype:ines-okafor", "ines-cheer");
    expect(await wizard.findByRole("status")).toHaveTextContent("Done. :ines-cheer: is your hype emoji for Ines Okafor in Slack now.");
    expect(wizard.getByRole("button", { name: "Done" })).toHaveFocus();
    expect(wizard.getByRole("button", { name: "Done" })).toHaveAccessibleDescription("Done. :ines-cheer: is your hype emoji for Ines Okafor in Slack now.");
  });

  it("a search that finds nothing ends with Add to Slack, which saves the picture under its name", async () => {
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      if (this.download !== "") saved.push(this.download);
    });
    const view = visit({ found: (_near, search) => (search === "" ? nearInes : []) });
    await view.user.click((await openTheEmojis(view)).getByRole("button", { name: "Find :level-5: in Slack" }));
    const wizard = await theWizard("level-5");

    await view.user.type(wizard.getByRole("searchbox", { name: "Search Slack's emojis" }), "zebra");

    expect(await wizard.findByText("No Slack emoji found for “zebra”. Add this one to Slack under its name.", {}, arrival)).toBeInTheDocument();
    expect(wizard.queryByRole("list", { name: "Slack emojis" })).not.toBeInTheDocument();
    await view.user.click(wizard.getByRole("button", { name: "Add to Slack: :level-5:" }));
    await waitFor(() => expect(saved).toEqual(["level-5.png"]));
  });

  it("a refused mapping says so and lets the member pick again", async () => {
    const view = visit({ mapMyEmoji: async () => ({ kind: "refused" }) });
    await view.user.click((await openTheEmojis(view)).getByRole("button", { name: "Find :ines-okafor-hype: in Slack" }));
    const wizard = await theWizard("ines-okafor-hype");

    await view.user.click(wizard.getByRole("button", { name: "Map to :ines-cheer:" }));

    expect(await wizard.findByRole("alert")).toHaveTextContent("That didn't save. It may be mapped already, or the maintainer set this one. Pick another one.");
    expect(wizard.getByRole("button", { name: "Map to :ines:" })).toBeEnabled();
    expect(wizard.getByRole("searchbox", { name: "Search Slack's emojis" })).toHaveFocus();
  });

  it("a search whose every match is in use keeps them in sight and offers Add to Slack beneath", async () => {
    const view = visit({ found: (_near, search) => (search === "" ? nearInes : [{ name: "piggy", image: slackPicture("piggy"), free: false }]) });
    await view.user.click((await openTheEmojis(view)).getByRole("button", { name: "Find :level-5: in Slack" }));
    const wizard = await theWizard("level-5");

    await view.user.type(wizard.getByRole("searchbox", { name: "Search Slack's emojis" }), "pig");

    expect(await wizard.findByText("Every Slack emoji found for “pig” is in use. Add this one to Slack under its name.", {}, arrival)).toBeInTheDocument();
    expect(matchesIn(wizard)).toEqual(["Map to :piggy:, in use"]);
    expect(wizard.getByRole("button", { name: "Add to Slack: :level-5:" })).toBeInTheDocument();
  });

  it("clicking inside a wizard opened from the emoji popup keeps the popup open behind it", async () => {
    const view = visit();
    const popup = await openTheEmojis(view);
    await view.user.click(popup.getByRole("button", { name: "Find :ines-okafor-hype: in Slack" }));
    const wizard = await theWizard("ines-okafor-hype");

    await view.user.click(wizard.getByRole("searchbox", { name: "Search Slack's emojis" }));
    await view.user.click(wizard.getByRole("button", { name: "Map to :ines-cheer:" }));
    await view.user.click(await wizard.findByRole("button", { name: "Done" }));

    expect(screen.getByRole("region", { name: "Your emojis" })).toBeInTheDocument();
  });

  it("a person page offers Find in Slack for the hype emoji you hold that Slack doesn't have", async () => {
    visit({ path: "/book#people/ines-okafor" });

    expect(await screen.findByRole("button", { name: "Find :ines-okafor-hype: in Slack" }, arrival)).toBeInTheDocument();
  });

  it("mapping the emoji a moment shows updates the moment: its Slack name, its use line, and no second Find in Slack", async () => {
    const before: Album = { ...albumFixtures.newEmojis, emojiWizard: true, emojis: albumFixtures.newEmojis.emojis.map((emoji) => ({ ...emoji, seen: emoji.id !== "level:5" })) };
    const live = { album: before, listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    const mapMyEmoji = async (emoji: string, to: string) => {
      live.album = { ...live.album, emojis: live.album.emojis.map((each) => (each.id === emoji ? { ...each, name: to, picture: slackPicture(to), inSlack: true } : each)) };
      return { kind: "mapped" } as const;
    };
    window.history.replaceState(null, "", "/");
    const { user } = renderAlbum(memberWithTheAlbum, read, { slackEmojiMatches: slackEmojisFor(() => nearInes), commands: { mapMyEmoji } });
    const moment = within(await screen.findByRole("dialog", { name: "New emoji unlocked" }, arrival));
    const name = moment.getByRole("heading", { level: 2 }).textContent!.replaceAll(":", "");

    await user.click(moment.getByRole("button", { name: `Find :${name}: in Slack` }));
    await user.click((await theWizard(name)).getByRole("button", { name: "Map to :ines-cheer:" }));
    act(() => live.listeners.forEach((listener) => listener()));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(moment.getByRole("heading", { level: 2 })).toHaveTextContent(":ines-cheer:");
    expect(moment.getByText("Use it in Slack: react with it and put it in the kudos you give.")).toBeInTheDocument();
    expect(moment.queryByRole("button", { name: /in Slack$/ })).not.toBeInTheDocument();
  });

  it("Escape closes the wizard and gives focus back to the opener", async () => {
    const view = visit({ path: "/book#milestones" });
    const opener = await screen.findByRole("button", { name: "Find :familiar-faces: in Slack" }, arrival);
    await view.user.click(opener);
    expect(await theWizard("familiar-faces")).toBeTruthy();

    await view.user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Find :familiar-faces: in Slack" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("with emoji-wizard off, nothing changes: Add to Slack stays and no Slack emoji is searched", async () => {
    const view = visit({ album: albumFixtures.midway });
    const popup = await openTheEmojis(view);

    expect(popup.getByRole("button", { name: "Add to Slack: :ines-okafor-hype:" })).toBeInTheDocument();
    expect(popup.queryByRole("button", { name: /in Slack$/ })).not.toBeInTheDocument();
    expect(view.asked).toEqual([]);
  });
});

const appEmojis: AppEmoji[] = [
  { key: "level:5", kind: "level", name: "five", from: "Level 5", picture: "/emoji/level-5.png", holders: 12, slack: { image: slackPicture("five"), setBy: { by: "maintainer", name: "Sam Example" } }, place: { kind: "level", level: 5 } },
  { key: "team:quiet-harbour", kind: "team", name: "team-quiet-harbour", from: "Quiet Harbour", picture: "/emoji/team-quiet-harbour.png", holders: 9, slack: null, place: { kind: "team", team: "quiet-harbour" } },
  { key: "team:lanterns", kind: "team", name: "lantern-glow", from: "Lanterns", picture: "/emoji/team-lanterns.png", holders: 6, slack: { image: slackPicture("lantern-glow"), setBy: { by: "member", name: "Bram Teller" } }, place: { kind: "team", team: "lanterns" } },
  { key: "hype:k1", kind: "hype", name: "ines-okafor-hype", from: "Ines Okafor", picture: "/emoji/hype.png", holders: 4, slack: null, place: { kind: "hype", person: "k1" } },
  { key: "level:25", kind: "level", name: "level-25", from: "Level 25", picture: "/emoji/level-25.png", holders: 0, slack: null, place: { kind: "level", level: 25 } },
];

function fixedAppEmojis(emojis: AppEmoji[]): AppEmojisRead {
  const answer: AppEmojis = { kind: "app-emojis", emojis, more: false, emojiPage: "https://hedgehug.slack.com/customize/emoji" };
  return (asking) => (asking ? answer : undefined);
}

async function theAppEmojis() {
  return within(await screen.findByRole("region", { name: "App emojis in Slack" }, arrival));
}

function rowsOf(list: ReturnType<typeof within>): string[] {
  return within(list.getByRole("list", { name: /emojis$/ }))
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

describe("#719: the maintainer lists every app emoji, not mapped first, and maps each through the same wizard", { timeout: 30_000 }, () => {
  it("Not mapped lists each app emoji Slack doesn't have with its picture, name, what earns it and how many hold it, most held first", async () => {
    visit({ path: "/settings", appEmojis: fixedAppEmojis(appEmojis) });
    const list = await theAppEmojis();

    expect(list.getByRole("button", { name: "Not mapped · 3" })).toHaveAttribute("aria-pressed", "true");
    expect(rowsOf(list)).toEqual([":team-quiet-harbour:Quiet Harbour team · 9 hold itFind in Slack", ":ines-okafor-hype:Ines Okafor's hype · 4 hold itFind in Slack", ":level-25:Level 25 · nobody yetFind in Slack"]);
  });

  it("Find in Slack opens the wizard, and the maintainer's pick maps the Slack emoji to that place, even one in use", async () => {
    const mapSlackEmoji = vi.fn(async () => ({ kind: "mapped" }) as const);
    const view = visit({ path: "/settings", appEmojis: fixedAppEmojis(appEmojis), mapSlackEmoji });
    const list = await theAppEmojis();

    await view.user.click(list.getByRole("button", { name: "Find :ines-okafor-hype: in Slack" }));
    const wizard = await theWizard("ines-okafor-hype");
    expect(wizard.getByText("Picking one in use gives it to this emoji: an earned emoji that had it moves to a free name, and a random drop or a held-back name stops being one.")).toBeInTheDocument();
    await view.user.click(wizard.getByRole("button", { name: "Map to :ines-old:, in use" }));

    expect(mapSlackEmoji).toHaveBeenCalledExactlyOnceWith("ines-old", { kind: "hype", person: "k1" });
    expect(await wizard.findByRole("status")).toHaveTextContent("Done. :ines-old: is the hype emoji for Ines Okafor in Slack now.");
  });

  it("Mapped shows each app emoji's Slack emoji and who set it; a member's mapping can be undone, which holds the Slack emoji back", async () => {
    const mapSlackEmoji = vi.fn(async () => ({ kind: "mapped" }) as const);
    const view = visit({ path: "/settings", appEmojis: fixedAppEmojis(appEmojis), mapSlackEmoji });
    const list = await theAppEmojis();

    await view.user.click(list.getByRole("button", { name: "Mapped · 2" }));

    expect(rowsOf(list)).toEqual([":five:Level 5 · 12 hold it · set by youChange", ":lantern-glow:Lanterns team · 6 hold it · set by Bram TellerChangeUndo"]);
    await view.user.click(list.getByRole("button", { name: "Undo Bram Teller's mapping of :lantern-glow:" }));

    expect(mapSlackEmoji).toHaveBeenCalledExactlyOnceWith("lantern-glow", { kind: "unmapped" });
    expect(await list.findByRole("status")).toHaveTextContent("Undone. :lantern-glow: is no longer mapped, and members can't take it again until you map it.");
    expect(list.getByRole("button", { name: "Mapped · 2" })).toHaveFocus();
  });

  it("#736: Change opens the wizard as a change, and a refused pick gives the maintainer's reasons", async () => {
    const view = visit({ path: "/settings", appEmojis: fixedAppEmojis(appEmojis), mapSlackEmoji: async () => ({ kind: "refused" }) });
    const list = await theAppEmojis();
    await view.user.click(list.getByRole("button", { name: "Mapped · 2" }));

    await view.user.click(list.getByRole("button", { name: "Change :five: in Slack" }));
    const wizard = within(await screen.findByRole("dialog", { name: "Change :five: in Slack" }, arrival));
    await view.user.click(wizard.getByRole("button", { name: "Map to :ines-cheer:" }));

    expect(await wizard.findByRole("alert")).toHaveTextContent("That didn't save. The Slack emoji may be gone from Slack, or only the workspace maintainer can map emojis. Pick another one.");
  });

  it("an Undo that can't reach HedgeHug says so and can be tried again", async () => {
    const view = visit({ path: "/settings", appEmojis: fixedAppEmojis(appEmojis), mapSlackEmoji: async () => Promise.reject(new Error("HedgeHug didn't answer in time.")) });
    const list = await theAppEmojis();
    await view.user.click(list.getByRole("button", { name: "Mapped · 2" }));

    await view.user.click(list.getByRole("button", { name: "Undo Bram Teller's mapping of :lantern-glow:" }));

    expect(await list.findByRole("alert")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(list.getByRole("button", { name: "Undo Bram Teller's mapping of :lantern-glow:" })).toBeEnabled();
  });

  it("the list stays away while the maintainer's read is off", async () => {
    visit({ path: "/settings", appEmojis: (asking) => (asking ? { kind: "off" } : undefined) });

    expect(await screen.findByRole("heading", { name: "Settings" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "App emojis in Slack" })).not.toBeInTheDocument();
  });
});
