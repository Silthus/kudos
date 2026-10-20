import { act, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album } from "./answer";

type Mapper = "admin" | "member";

type Visit = { as: Mapper; path: string; inSlack?: Record<string, boolean>; matches?: SlackEmojiMatchesRead; mapMyEmoji?: (emoji: string, to: string) => Promise<{ kind: "mapped" } | { kind: "refused" }> };

const arrival = { timeout: 10_000 };

const comingSoon = "Coming soon to Slack";

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;

const found: SlackEmojiMatchesRead = () => ({
  kind: "matches",
  matches: [
    { name: "harbour-wave", image: slackPicture("harbour-wave"), free: true },
    { name: "harbour-old", image: slackPicture("harbour-old"), free: false },
    { name: "quiet-harbour", image: slackPicture("quiet-harbour"), free: false },
  ],
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function albumAs(as: Mapper, inSlack: Record<string, boolean> = {}): Album {
  const { midway } = albumFixtures;
  return { ...midway, emojiWizard: true, emojiInPlace: as, emojis: midway.emojis.map((emoji) => (emoji.id in inSlack ? { ...emoji, inSlack: inSlack[emoji.id]! } : emoji)) };
}

function visit({ as, path, inSlack, matches = found, mapMyEmoji = async () => ({ kind: "mapped" }) }: Visit) {
  window.history.replaceState(null, "", path);
  const album = albumAs(as, inSlack);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { people: fixedPeople(album), slackEmojiMatches: matches, commands: { mapMyEmoji } });
}

function offersNoWayToSlack() {
  expect(screen.queryByRole("button", { name: /in Slack$|^Add to Slack/ })).not.toBeInTheDocument();
}

async function medalOf(name: string) {
  return within((await screen.findByText(`:${name}:`, {}, arrival)).closest("figure")!);
}

describe("#736: with emoji-mapping-in-place on, the maintainer maps app emojis where they show and members see coming soon", { timeout: 30_000 }, () => {
  describe("Milestones", () => {
    it("the maintainer maps every tier's emoji in place: Find in Slack where Slack hasn't it, earned or not, and Change where it has", async () => {
      visit({ as: "admin", path: "/book#milestones" });

      expect((await medalOf("familiar-faces")).getByRole("button", { name: "Find :familiar-faces: in Slack" })).toBeInTheDocument();
      const notYetEarned = await medalOf("full-of-friends");
      expect(notYetEarned.getByText("Unlocks at 25")).toBeInTheDocument();
      expect(notYetEarned.getByRole("button", { name: "Find :full-of-friends: in Slack" })).toBeInTheDocument();
      const inSlack = await medalOf("first-face");
      expect(inSlack.getByText("In Slack")).toBeInTheDocument();
      expect(inSlack.getByRole("button", { name: "Change :first-face: in Slack" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
    });

    it("a member sees coming soon where Slack hasn't an earned emoji, and is offered no wizard, Add to Slack or download", async () => {
      visit({ as: "member", path: "/book#milestones" });

      expect((await medalOf("familiar-faces")).getByText(comingSoon)).toBeInTheDocument();
      expect(screen.getByText(":familiar-faces:").closest("figure")!.querySelector("img")).toHaveAttribute("src", "/emoji/milestone-people-silver.png");
      expect((await medalOf("first-face")).getByText("In Slack")).toBeInTheDocument();
      expect((await medalOf("full-of-friends")).getByText("Unlocks at 25")).toBeInTheDocument();
      offersNoWayToSlack();
    });
  });

  describe("a team page", () => {
    it("the maintainer changes the team emoji Slack has, and finds the one it hasn't", async () => {
      const inSlack = visit({ as: "admin", path: "/book#teams/quiet-harbour" });
      expect(await screen.findByRole("button", { name: "Change :quiet-harbour: in Slack" }, arrival)).toBeInTheDocument();
      inSlack.unmount();

      visit({ as: "admin", path: "/book#teams/quiet-harbour", inSlack: { "team:quiet-harbour": false } });
      expect(await screen.findByRole("button", { name: "Find :quiet-harbour: in Slack" }, arrival)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
    });

    it("the maintainer maps the team emoji of a team they haven't unlocked", async () => {
      visit({ as: "admin", path: "/book#teams/lanterns" });

      expect(await screen.findByText(/team emoji unlocks with the sticker/, {}, arrival)).toHaveTextContent("The :lanterns: team emoji unlocks with the sticker.");
      expect(screen.getByRole("button", { name: "Find :lanterns: in Slack" })).toBeInTheDocument();
    });

    it("a member sees coming soon for an unlocked team emoji Slack hasn't, the use line where Slack has it, and no team emoji on a team still locked", async () => {
      const notInSlack = visit({ as: "member", path: "/book#teams/quiet-harbour", inSlack: { "team:quiet-harbour": false } });
      expect(await screen.findByText(comingSoon, {}, arrival)).toBeInTheDocument();
      expect(screen.getByText(/team emoji\./)).toHaveTextContent("You got the :quiet-harbour: team emoji.");
      offersNoWayToSlack();
      notInSlack.unmount();

      const inSlack = visit({ as: "member", path: "/book#teams/quiet-harbour" });
      expect(await screen.findByText(/team emoji\./, {}, arrival)).toHaveTextContent("You got the :quiet-harbour: team emoji. Use it in Slack: react with it and put it in the kudos you give.");
      expect(screen.queryByText(comingSoon)).not.toBeInTheDocument();
      offersNoWayToSlack();
      inSlack.unmount();

      visit({ as: "member", path: "/book#teams/lanterns" });
      expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" }, arrival)).toBeInTheDocument();
      expect(screen.queryByText(/team emoji/)).not.toBeInTheDocument();
      offersNoWayToSlack();
    });
  });

  describe("a person page", () => {
    it("the maintainer finds the hype emoji Slack hasn't, changes the one it has, and maps one they haven't earned", async () => {
      const notInSlack = visit({ as: "admin", path: "/book#people/ines-okafor" });
      expect(await screen.findByRole("button", { name: "Find :ines-okafor-hype: in Slack" }, arrival)).toBeInTheDocument();
      notInSlack.unmount();

      const inSlack = visit({ as: "admin", path: "/book#people/ines-okafor", inSlack: { "hype:ines-okafor": true } });
      expect(await screen.findByRole("button", { name: "Change :ines-okafor-hype: in Slack" }, arrival)).toBeInTheDocument();
      inSlack.unmount();

      visit({ as: "admin", path: "/book#people/bram-teller" });
      expect(await screen.findByRole("button", { name: "Find :bram-teller-hype: in Slack" }, arrival)).toBeInTheDocument();
    });

    it("a member sees coming soon for an earned hype emoji Slack hasn't, and nothing to do for one Slack has or one not earned", async () => {
      const notInSlack = visit({ as: "member", path: "/book#people/ines-okafor" });
      expect(await screen.findByText(comingSoon, {}, arrival)).toBeInTheDocument();
      offersNoWayToSlack();
      notInSlack.unmount();

      const inSlack = visit({ as: "member", path: "/book#people/ines-okafor", inSlack: { "hype:ines-okafor": true } });
      expect(await screen.findByText(":ines-okafor-hype:", {}, arrival)).toBeInTheDocument();
      expect(screen.queryByText(comingSoon)).not.toBeInTheDocument();
      offersNoWayToSlack();
      inSlack.unmount();

      visit({ as: "member", path: "/book#people/bram-teller" });
      expect(await screen.findByText(":bram-teller-hype:", {}, arrival)).toBeInTheDocument();
      expect(screen.queryByText(comingSoon)).not.toBeInTheDocument();
      offersNoWayToSlack();
    });
  });

  it("the maintainer's wizard takes any Slack emoji, one in use included, and maps the emoji by its ID", async () => {
    const mapMyEmoji = vi.fn(async () => ({ kind: "mapped" }) as const);
    const view = visit({ as: "admin", path: "/book#teams/quiet-harbour", mapMyEmoji });

    await view.user.click(await screen.findByRole("button", { name: "Change :quiet-harbour: in Slack" }, arrival));
    const wizard = within(await screen.findByRole("dialog", { name: "Change :quiet-harbour: in Slack" }, arrival));
    expect(wizard.getByText("Pick the Slack emoji that is the Quiet Harbour team emoji. Everyone who has it can use it in Slack at once.")).toBeInTheDocument();
    await view.user.click(wizard.getByRole("button", { name: "Map to :harbour-old:, in use" }));

    expect(mapMyEmoji).toHaveBeenCalledExactlyOnceWith("team:quiet-harbour", "harbour-old");
    expect(await wizard.findByRole("status")).toHaveTextContent("Done. :harbour-old: is the Quiet Harbour team emoji in Slack now.");
  });

  it("Change opens the wizard as a change, with the emoji's own Slack emoji marked current, not in use", async () => {
    const view = visit({ as: "admin", path: "/book#teams/quiet-harbour" });

    await view.user.click(await screen.findByRole("button", { name: "Change :quiet-harbour: in Slack" }, arrival));
    const wizard = within(await screen.findByRole("dialog", { name: "Change :quiet-harbour: in Slack" }, arrival));

    expect(wizard.getByRole("button", { name: "Map to :quiet-harbour:, current" })).toHaveTextContent("Current");
    expect(wizard.getByRole("button", { name: "Map to :quiet-harbour:, current" }), "picking the current one would take a member's mapping over").toBeDisabled();
    expect(wizard.getByRole("button", { name: "Map to :harbour-old:, in use" })).toBeEnabled();
  });

  it("the note about taking an emoji in use stays away while the only one in use is the current one", async () => {
    const onlyTheCurrent: SlackEmojiMatchesRead = () => ({ kind: "matches", matches: [{ name: "quiet-harbour", image: slackPicture("quiet-harbour"), free: false }, { name: "harbour-wave", image: slackPicture("harbour-wave"), free: true }] });
    const view = visit({ as: "admin", path: "/book#teams/quiet-harbour", matches: onlyTheCurrent });

    await view.user.click(await screen.findByRole("button", { name: "Change :quiet-harbour: in Slack" }, arrival));
    const wizard = within(await screen.findByRole("dialog", { name: "Change :quiet-harbour: in Slack" }, arrival));

    expect(wizard.getByRole("button", { name: "Map to :quiet-harbour:, current" })).toBeInTheDocument();
    expect(wizard.queryByText(/^Picking one in use/)).not.toBeInTheDocument();
  });

  it("a refused pick tells the maintainer why it can fail for them, not a member's reasons", async () => {
    const view = visit({ as: "admin", path: "/book#teams/quiet-harbour", inSlack: { "team:quiet-harbour": false }, mapMyEmoji: async () => ({ kind: "refused" }) });

    await view.user.click(await screen.findByRole("button", { name: "Find :quiet-harbour: in Slack" }, arrival));
    const wizard = within(await screen.findByRole("dialog", { name: "Find :quiet-harbour: in Slack" }, arrival));
    await view.user.click(wizard.getByRole("button", { name: "Map to :harbour-wave:" }));

    expect(await wizard.findByRole("alert")).toHaveTextContent("That didn't save. The Slack emoji may be gone from Slack, or only the workspace maintainer can map emojis. Pick another one.");
  });

  it("once the maintainer maps an emoji, its page names the Slack emoji and offers Change", async () => {
    const live = { album: albumAs("admin", { "team:quiet-harbour": false }), listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    const mapMyEmoji = async (emoji: string, to: string) => {
      live.album = { ...live.album, emojis: live.album.emojis.map((each) => (each.id === emoji ? { ...each, name: to, picture: slackPicture(to), inSlack: true } : each)) };
      return { kind: "mapped" } as const;
    };
    window.history.replaceState(null, "", "/book#teams/quiet-harbour");
    const { user } = renderAlbum(shellFixtures.member, read, { people: fixedPeople(live.album), slackEmojiMatches: found, commands: { mapMyEmoji } });

    await user.click(await screen.findByRole("button", { name: "Find :quiet-harbour: in Slack" }, arrival));
    await user.click(within(await screen.findByRole("dialog", { name: "Find :quiet-harbour: in Slack" }, arrival)).getByRole("button", { name: "Map to :harbour-wave:" }));
    act(() => live.listeners.forEach((listener) => listener()));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(screen.getByText(/team emoji\./)).toHaveTextContent("You got the :harbour-wave: team emoji. Use it in Slack");
    expect(screen.getByRole("button", { name: "Change :harbour-wave: in Slack" })).toBeInTheDocument();
  });

  it("a member's open wizard closes when emoji-mapping-in-place turns on under it", async () => {
    const live = { album: { ...albumAs("member"), emojiInPlace: null } as Album, listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/book#milestones");
    const { user } = renderAlbum(shellFixtures.member, read, { people: fixedPeople(live.album), slackEmojiMatches: found });
    await user.click(await screen.findByRole("button", { name: "Find :familiar-faces: in Slack" }, arrival));
    expect(await screen.findByRole("dialog", { name: "Find :familiar-faces: in Slack" }, arrival)).toBeInTheDocument();

    live.album = { ...live.album, emojiInPlace: "member" };
    act(() => live.listeners.forEach((listener) => listener()));

    expect(screen.queryByRole("dialog", { name: "Find :familiar-faces: in Slack" })).not.toBeInTheDocument();
    expect(document.activeElement, "focus goes back to the page, not lost").not.toBe(document.body);
    offersNoWayToSlack();

    live.album = { ...live.album, emojiInPlace: null };
    act(() => live.listeners.forEach((listener) => listener()));
    expect(await screen.findByRole("button", { name: "Find :familiar-faces: in Slack" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Find :familiar-faces: in Slack" }), "the wizard stays closed").not.toBeInTheDocument();
  });

  it("the maintainer's open wizard closes when in-place mapping turns off under it", async () => {
    const live = { album: albumAs("admin"), listeners: new Set<() => void>() };
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore((listener) => (live.listeners.add(listener), () => live.listeners.delete(listener)), () => live.album);
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/book#teams/lanterns");
    const { user } = renderAlbum(shellFixtures.member, read, { people: fixedPeople(live.album), slackEmojiMatches: found });
    await user.click(await screen.findByRole("button", { name: "Find :lanterns: in Slack" }, arrival));
    expect(await screen.findByRole("dialog", { name: "Find :lanterns: in Slack" }, arrival)).toBeInTheDocument();

    live.album = { ...live.album, emojiInPlace: null };
    act(() => live.listeners.forEach((listener) => listener()));

    expect(screen.queryByRole("dialog", { name: "Find :lanterns: in Slack" })).not.toBeInTheDocument();
  });

  it("a member's emoji popup says coming soon too, never Find in Slack or Add to Slack", async () => {
    const view = visit({ as: "member", path: "/" });
    const [bar] = await screen.findAllByRole("banner", {}, arrival);
    await view.user.click(within(bar!).getByRole("button", { name: /^Your emojis/ }));
    const popup = within(screen.getByRole("region", { name: "Your emojis" }));

    expect(popup.getAllByText(comingSoon).length).toBeGreaterThan(0);
    expect(popup.queryByRole("button", { name: /in Slack$|^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("a member's emoji moment says coming soon for an emoji Slack hasn't, and offers no Find in Slack", async () => {
    const { newEmojis } = albumFixtures;
    const album: Album = { ...newEmojis, emojiWizard: true, emojiInPlace: "member", emojis: newEmojis.emojis.map((emoji) => ({ ...emoji, seen: emoji.id !== "level:5" })) };
    window.history.replaceState(null, "", "/");
    renderAlbum(shellFixtures.member, fixedAlbum(album), { slackEmojiMatches: found });
    const moment = within(await screen.findByRole("dialog", { name: "New emoji unlocked" }, arrival));

    expect(moment.getByText(comingSoon)).toBeInTheDocument();
    expect(moment.queryByRole("button", { name: /in Slack$|^Add to Slack/ })).not.toBeInTheDocument();
  });
});
