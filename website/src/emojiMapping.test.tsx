import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { albumFixtures, fixedAlbum } from "./album/albumFixtures";
import { emojiMappingsFixtures, shipitPicture, withMapping } from "./emojiMappingFixtures";
import type { EmojiMappingsShown } from "./emojiMappingsRead";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { shellFixtures, type EmojiMappingReply, type MemberProfile, type MySettings, type ShellActions } from "./shell";
import { renderAlbum } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

async function showSettings({ settings = settingsFixtures.forTheMaintainer, mappings = emojiMappingsFixtures.workspace as EmojiMappingsShown | undefined, mapSlackEmoji }: { settings?: MySettings; mappings?: EmojiMappingsShown | undefined; mapSlackEmoji?: ShellActions["mapSlackEmoji"] } = {}) {
  let shown = mappings;
  const view = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: fixedSettings(settings), emojiMappings: (asking) => (asking ? shown : undefined), commands: { mapSlackEmoji } });
  const showMappings = (next: EmojiMappingsShown | undefined) => {
    shown = next;
    view.showVisitor({ ...memberWithTheAlbum });
  };
  await screen.findByRole("heading", { name: "Settings" }, { timeout: 10_000 });
  return { ...view, showMappings };
}

function section() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Earned emojis in Slack" });
}

function rows() {
  return within(within(section()).getByRole("list", { name: "Slack emojis" })).getAllByRole("listitem");
}

function rowElementOf(name: string) {
  const row = rows().find((each) => within(each).queryByRole("heading", { name: `:${name}:` }) !== null);
  if (row === undefined) throw new Error(`no row for :${name}:`);
  return row;
}

function rowOf(name: string) {
  return within(rowElementOf(name));
}

function namesShown() {
  return rows().map((row) => within(row).getByRole("heading").textContent);
}

function answerLater() {
  let resolve: (answer: EmojiMappingReply) => void = () => undefined;
  const answer = new Promise<EmojiMappingReply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

describe("the maintainer maps Slack emojis to earned emojis in Settings", { timeout: 60_000 }, () => {
  it("leaves the section out for everyone but the maintainer, and while the read answers off", async () => {
    await showSettings({ settings: settingsFixtures.everything });
    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Earned emojis in Slack" })).not.toBeInTheDocument();
  });

  it("leaves the section out while the mappings read answers off", async () => {
    await showSettings({ mappings: { kind: "off" } });
    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Earned emojis in Slack" })).not.toBeInTheDocument();
  });

  it("lists the workspace's Slack emojis with their pictures and what each one is mapped to, the first 50, with a button for the rest", async () => {
    await showSettings();

    expect(rowOf("otters").getByText("Otters team emoji")).toBeInTheDocument();
    expect(rowOf("omar-haddad-hype").getByText("Omar Haddad's hype emoji")).toBeInTheDocument();
    expect(rowOf("full-of-friends").getByText("Full of friends milestone emoji")).toBeInTheDocument();
    expect(rowOf("level-10").getByText("Level 10 emoji")).toBeInTheDocument();
    expect(rowOf("party-parrot").getByText("Random drop")).toBeInTheDocument();
    expect(rowOf("shipit").getByText("Not mapped")).toBeInTheDocument();
    expect(rowElementOf("shipit").querySelector("img")).toHaveAttribute("src", shipitPicture);
    expect(rows()).toHaveLength(50);
    expect(within(section()).getByRole("button", { name: "Show 38 more" })).toBeInTheDocument();
  });

  it("finds Slack emojis by any part of their name, and filters them by what they are mapped to", async () => {
    const { user } = await showSettings();

    await user.type(within(section()).getByRole("searchbox", { name: "Find a Slack emoji" }), "parrot");
    expect(namesShown()).toEqual([":party-parrot:"]);
    await user.clear(within(section()).getByRole("searchbox", { name: "Find a Slack emoji" }));

    await user.selectOptions(within(section()).getByRole("combobox", { name: "Show" }), "Teams");
    expect(namesShown()).toEqual([":otters:"]);
    await user.selectOptions(within(section()).getByRole("combobox", { name: "Show" }), "Not mapped");
    expect(namesShown()).toContain(":shipit:");
    expect(namesShown()).not.toContain(":otters:");
    await user.type(within(section()).getByRole("searchbox", { name: "Find a Slack emoji" }), "zzz");
    expect(within(section()).getByText("No Slack emoji matches that.")).toBeInTheDocument();
  });

  it("maps a Slack emoji to a team inline and says so once the read shows it", async () => {
    const later = answerLater();
    const { user, actions, showMappings } = await showSettings({ mapSlackEmoji: () => later.answer });

    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "A team");
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Team" }), "Workflows");
    await user.click(rowOf("shipit").getByRole("button", { name: "Save" }));

    expect(actions.mapSlackEmoji).toHaveBeenCalledWith("shipit", { kind: "team", team: "workflows" });
    await act(async () => later.resolve({ kind: "mapped" }));
    showMappings(withMapping(emojiMappingsFixtures.workspace, "shipit", { kind: "team", team: "workflows" }));
    expect(rowOf("shipit").getByText("Workflows team emoji")).toBeInTheDocument();
    expect(rowOf("shipit").getByRole("status")).toHaveTextContent(":shipit: is now the Workflows team emoji.");
  });

  it("maps a Slack emoji to a person's hype emoji, found by name", async () => {
    const { user, actions } = await showSettings({ mapSlackEmoji: async () => ({ kind: "mapped" }) });

    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "A person's hype");
    await user.type(rowOf("shipit").getByRole("searchbox", { name: "Find a person" }), "ada");
    await user.click(rowOf("shipit").getByRole("button", { name: "Ada Lindqvist" }));
    await user.click(rowOf("shipit").getByRole("button", { name: "Save" }));

    expect(actions.mapSlackEmoji).toHaveBeenCalledWith("shipit", { kind: "hype", person: "k-ada" });
  });

  it("maps to a milestone, a level and the random drops, and clears a mapping", async () => {
    const { user, actions } = await showSettings({ mapSlackEmoji: async () => ({ kind: "mapped" }) });
    const map = async (name: string, place: string, choice?: [string, string]) => {
      await user.click(rowOf(name).getByRole("button", { name: `Change :${name}:` }));
      await user.selectOptions(rowOf(name).getByRole("combobox", { name: "Map to" }), place);
      if (choice !== undefined) await user.selectOptions(rowOf(name).getByRole("combobox", { name: choice[0] }), choice[1]);
      await user.click(rowOf(name).getByRole("button", { name: "Save" }));
    };

    await map("shipit", "A milestone", ["Milestone", "Heart of the team"]);
    await map("hedgehog", "A level", ["Level", "Level 25"]);
    await map("yak-001", "Random drops");
    await map("otters", "Not mapped");

    expect(actions.mapSlackEmoji.mock.calls).toEqual([
      ["shipit", { kind: "milestone", milestone: "thoughtful" }],
      ["hedgehog", { kind: "level", level: 25 }],
      ["yak-001", { kind: "random" }],
      ["otters", { kind: "unmapped" }],
    ]);
  });

  it("keeps Save off until the place is complete and differs from today's, and says when a change is refused", async () => {
    const { user } = await showSettings({ mapSlackEmoji: async () => ({ kind: "refused" }) });

    await user.click(rowOf("otters").getByRole("button", { name: "Change :otters:" }));
    expect(rowOf("otters").getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
    await user.selectOptions(rowOf("otters").getByRole("combobox", { name: "Map to" }), "A person's hype");
    expect(rowOf("otters").getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
    await user.selectOptions(rowOf("otters").getByRole("combobox", { name: "Map to" }), "Random drops");
    await user.click(rowOf("otters").getByRole("button", { name: "Save" }));

    expect(rowOf("otters").getByRole("status")).toHaveTextContent("That couldn't be changed.");
  });

  it("keeps a row saved under a filter in view with its confirmation, until the filter changes", async () => {
    const { user, showMappings } = await showSettings({ mapSlackEmoji: async () => ({ kind: "mapped" }) });
    await user.selectOptions(within(section()).getByRole("combobox", { name: "Show" }), "Not mapped");

    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "Random drops");
    await user.click(rowOf("shipit").getByRole("button", { name: "Save" }));
    showMappings(withMapping(emojiMappingsFixtures.workspace, "shipit", { kind: "random" }));

    expect(rowOf("shipit").getByRole("button", { name: "Change :shipit:" })).toHaveFocus();
    expect(rowOf("shipit").getByRole("status")).toHaveTextContent(":shipit: is now a random drop.");
    await user.selectOptions(within(section()).getByRole("combobox", { name: "Show" }), "Every emoji");
    await user.selectOptions(within(section()).getByRole("combobox", { name: "Show" }), "Not mapped");
    expect(namesShown()).not.toContain(":shipit:");
  });

  it("says what a change displaces: the Slack emoji that holds the place now, and an earned emoji leaving Slack", async () => {
    const { user } = await showSettings();

    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "A team");
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Team" }), "Otters");
    expect(rowOf("shipit").getByText(":otters: holds it now and becomes unmapped.")).toBeInTheDocument();
    await user.click(rowOf("shipit").getByRole("button", { name: "Cancel" }));

    await user.click(rowOf("otters").getByRole("button", { name: "Change :otters:" }));
    await user.selectOptions(rowOf("otters").getByRole("combobox", { name: "Map to" }), "Not mapped");
    expect(rowOf("otters").getByText("The Otters team emoji leaves Slack until Slack has an emoji of its new name.")).toBeInTheDocument();
    await user.selectOptions(rowOf("otters").getByRole("combobox", { name: "Map to" }), "A level");
    await user.selectOptions(rowOf("otters").getByRole("combobox", { name: "Level" }), "Level 10");
    expect(rowOf("otters").getByText("The Otters team emoji leaves Slack until Slack has an emoji of its new name.")).toBeInTheDocument();
    expect(rowOf("otters").getByText(":level-10: holds it now and becomes unmapped.")).toBeInTheDocument();
    await user.click(rowOf("otters").getByRole("button", { name: "Cancel" }));

    await user.click(rowOf("omar-haddad-hype").getByRole("button", { name: "Change :omar-haddad-hype:" }));
    await user.selectOptions(rowOf("omar-haddad-hype").getByRole("combobox", { name: "Map to" }), "Not mapped");
    expect(rowOf("omar-haddad-hype").getByText("Omar Haddad's hype emoji leaves Slack until Slack has an emoji of its new name.")).toBeInTheDocument();
  });

  it("keeps Save off for a 101st random drop and says why", async () => {
    const moreDrops = Array.from({ length: 99 }, (_, index) => ({ name: `zebra-${index}`, image: shipitPicture, mapping: { kind: "random" as const } }));
    const full = { ...emojiMappingsFixtures.workspace, emoji: [...emojiMappingsFixtures.workspace.emoji, ...moreDrops] };
    const { user } = await showSettings({ mappings: full });

    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "Random drops");

    expect(rowOf("shipit").getByText("Random drops hold at most 100 emojis. Unmap one first.")).toBeInTheDocument();
    expect(rowOf("shipit").getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows 50 more rows at a time, so every emoji a search finds can be reached", async () => {
    const { user } = await showSettings();

    await user.click(within(section()).getByRole("button", { name: "Show 38 more" }));

    expect(rows()).toHaveLength(88);
    expect(within(section()).queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("says when the list is loading, when it didn't load, and when Slack has no custom emoji yet", async () => {
    const { showMappings } = await showSettings({ mappings: { kind: "connecting" } });
    expect(section()).toHaveAttribute("aria-busy", "true");
    showMappings({ kind: "broken" });
    expect(within(section()).getByText("The workspace's Slack emoji didn't load. Try again in a moment.")).toBeInTheDocument();
    showMappings({ ...emojiMappingsFixtures.workspace, emoji: [] });
    expect(within(section()).getByText("Slack has no custom emoji for this workspace yet.")).toBeInTheDocument();
  });

  it("offers no random drops place or filter while random-emojis is off for the maintainer", async () => {
    const { user } = await showSettings({ mappings: { ...emojiMappingsFixtures.workspace, randomDrops: false } });

    expect(within(within(section()).getByRole("combobox", { name: "Show" })).queryByRole("option", { name: "Random drops" })).not.toBeInTheDocument();
    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    expect(within(rowOf("shipit").getByRole("combobox", { name: "Map to" })).queryByRole("option", { name: "Random drops" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations, with an editor open", async () => {
    const { user, container } = await showSettings();
    await user.click(rowOf("shipit").getByRole("button", { name: "Change :shipit:" }));
    await user.selectOptions(rowOf("shipit").getByRole("combobox", { name: "Map to" }), "A person's hype");

    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ html }) => html).join(", ")}`)).toEqual([]);
  });
});
