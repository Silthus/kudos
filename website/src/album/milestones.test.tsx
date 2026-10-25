import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import answeredBefore707 from "./milestonesAnsweredBefore707.json";
import type { Album, AlbumEmoji, AlbumMilestone } from "./answer";

const arrival = 10_000;

const memberWithTheAlbum = shellFixtures.member;

const midway = albumFixtures.midway;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(album: Album = midway) {
  window.history.replaceState(null, "", "/book#milestones");
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album));
}

async function sectionOf(name: string) {
  return within(await screen.findByRole("region", { name }, { timeout: arrival }));
}

async function medalsListedUnder(name: string) {
  return within((await sectionOf(name)).getByRole("list")).getAllByRole("listitem", { name: /./ });
}

async function medalNamed(section: string, name: string) {
  return within((await sectionOf(section)).getByRole("listitem", { name }));
}

function emojiIn(medal: ReturnType<typeof within>) {
  const emoji = medal.getByRole("figure");
  return { picture: emoji.querySelector("img")?.getAttribute("src"), name: within(emoji).getByText(/^:.+:$/).textContent, earned: emoji.hasAttribute("data-earned"), says: emoji.querySelector(".al-ms-emoji-says")?.textContent };
}

function withEmoji(album: Album, emoji: AlbumEmoji): Album {
  return { ...album, emojis: [...album.emojis.filter(({ id }) => id !== emoji.id), emoji] };
}

function withoutMilestoneEmojis(album: Album): Album {
  return { ...album, emojis: album.emojis.filter(({ kind }) => kind !== "milestone") };
}

function answeredBeforeEveryTier(album: Album): Album {
  const { emojis, milestones } = answeredBefore707 as Pick<Album, "emojis" | "milestones">;
  return { ...album, emojis: [...withoutMilestoneEmojis(album).emojis, ...emojis], milestones };
}

function savedPictures() {
  const saved: { href: string; download: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download !== "") saved.push({ href: this.getAttribute("href") ?? "", download: this.download });
  });
  return saved;
}

function withMilestone(album: Album, milestone: AlbumMilestone): Album {
  return { ...album, milestones: album.milestones.map((listed) => (listed.id === milestone.id ? milestone : listed)) };
}

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");


const lede = "Earn medals as your album grows: the people and teams you collect, the hoggies you find and the thoughtful kudos you give. Every medal unlocks its own emoji for Slack.";

function nameOf(medal: HTMLElement) {
  return within(medal).getByRole("heading", { level: 3 }).textContent;
}

function withEveryMedal(album: Album, id: AlbumMilestone["id"]): Album {
  const listed = album.milestones.find((milestone) => milestone.id === id)!;
  return withMilestone(album, { ...listed, count: listed.tiers.at(-1)!.at, tiers: listed.tiers.map((tier) => ({ ...tier, earnedAt: tier.earnedAt ?? now - day })) });
}

describe("AL51: Milestones puts the next steps first: what to do, the closest medal of every milestone, then the medals earned", { timeout: 60_000 }, () => {
  it("says what the page collects and what every medal unlocks, then counts the medals earned of all twenty and per metal", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Milestones" }, { timeout: arrival })).toBeInTheDocument();
    expect(screen.getByText(lede)).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("6 of 20 medals");
    const metals = within(screen.getByRole("list", { name: "Medals by metal" })).getAllByRole("listitem");
    expect(metals.map((metal) => metal.textContent)).toEqual(["Bronze 5 of 5", "Silver 1 of 5", "Gold 0 of 5", "Diamond 0 of 5"]);
  });

  it("offers each team ready to unlock, linking to its page, and thanking someone with a reason as what to do next", async () => {
    visit();

    const next = await sectionOf("Do this next");
    expect(next.getAllByRole("listitem")).toHaveLength(2);
    expect(next.getByRole("link", { name: /^Unlock Kettle Works/ })).toHaveAttribute("href", "/book#teams/kettle-works");
    expect(next.getByText("Thank someone in Slack and say why")).toBeInTheDocument();
  });

  it("without a team ready to unlock, only thanking someone is left to do", async () => {
    visit(albumFixtures.newcomer);

    const next = await sectionOf("Do this next");
    expect(next.getAllByRole("listitem")).toHaveLength(1);
    expect(next.queryByRole("link", { name: /^Unlock/ })).not.toBeInTheDocument();
  });

  it("lists the next medal of every milestone, the closest first, each with its progress, what is still to go, how to get there and the emoji it unlocks", async () => {
    visit();

    expect((await medalsListedUnder("Closest medals")).map(nameOf)).toEqual(["Bridge builder", "Full of friends", "Collector", "Generous soul", "Five teams strong"]);
    const bridge = await medalNamed("Closest medals", "Bridge builder");
    expect(bridge.getByText("Silver · Across the company")).toBeInTheDocument();
    expect(bridge.getByRole("progressbar", { name: "Bridge builder" })).toHaveAttribute("aria-valuenow", "6");
    expect(bridge.getByRole("progressbar", { name: "Bridge builder" })).toHaveAttribute("aria-valuemax", "10");
    expect(bridge.getByText("4 to go")).toBeInTheDocument();
    expect(bridge.getByText("6 of 10 teams with someone in your album")).toBeInTheDocument();
    expect(bridge.getByText("Turn over items until someone from a new team lands")).toBeInTheDocument();
    expect(emojiIn(bridge)).toEqual({ picture: "/emoji/milestone-reach-silver.png", name: ":bridge-builder:", earned: false, says: "Unlocks at 10" });
  });

  it("says how to move every milestone", async () => {
    visit();

    const hints = await Promise.all(["Full of friends", "Collector", "Generous soul", "Five teams strong"].map(async (name) => (await medalNamed("Closest medals", name)).getByText(/^[A-Z].+[a-z]$/, { selector: ".al-ms-hint" }).textContent));
    expect(hints).toEqual(["Say why when you thank someone, then turn over the items it earns", "Turn over items: some of them are hoggies", "Thank someone in Slack and say why", "Get everyone on a team into your album, then unlock its sticker"]);
  });

  it("a newcomer sees every milestone's bronze in the catalogue's order and nothing earned yet", async () => {
    visit(albumFixtures.newcomer);

    expect((await medalsListedUnder("Closest medals")).map(nameOf)).toEqual(["First face", "First full page", "Next door", "Curious", "First thank-you"]);
    expect((await medalNamed("Closest medals", "First face")).getByText("1 to go")).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("0 of 20 medals");
    expect(screen.queryByRole("region", { name: "Earned" })).not.toBeInTheDocument();
  });

  it("leaves a milestone with every medal out of the closest medals", async () => {
    visit(withEveryMedal(midway, "thoughtful"));

    expect((await medalsListedUnder("Closest medals")).map(nameOf)).toEqual(["Bridge builder", "Full of friends", "Collector", "Five teams strong"]);
  });

  it("once every medal is earned, says nothing is left to unlock", async () => {
    visit(midway.milestones.reduce((album, { id }) => withEveryMedal(album, id), midway));

    expect((await sectionOf("Closest medals")).getByText("Every medal earned. Nothing left to unlock.")).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("20 of 20 medals");
  });

  it("lists the medals earned, the newest first, each with its metal, its milestone, its date and its emoji in colour", async () => {
    visit();

    expect((await medalsListedUnder("Earned")).map(nameOf)).toEqual(["Familiar faces", "First full page", "Curious", "Next door", "First face", "First thank-you"]);
    const familiar = await medalNamed("Earned", "Familiar faces");
    expect(familiar.getByText("Silver · Faces in the album · 16 Oct 2026")).toBeInTheDocument();
    expect(emojiIn(familiar)).toEqual({ picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "Add to Slack" });
    expect(emojiIn(await medalNamed("Earned", "First face"))).toEqual({ picture: "/emoji/milestone-people-bronze.png", name: ":first-face:", earned: true, says: "In Slack" });
  });

  it("before the album answers its milestones, says where they will show", async () => {
    visit({ ...midway, milestones: [] });

    expect(await screen.findByText("Your milestones show here once your album starts filling.", undefined, { timeout: arrival })).toBeInTheDocument();
  });

  it("#707: names each emoji as the album's earned emojis name it, so a name the registry numbered shows numbered", async () => {
    const numbered: AlbumEmoji = { id: "milestone:people:gold", kind: "milestone", name: "full-of-friends-2", from: "Full of friends", picture: "/emoji/milestone-people-gold.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 12, need: 25 } };
    visit(withEmoji(midway, numbered));

    expect(emojiIn(await medalNamed("Closest medals", "Full of friends"))).toMatchObject({ name: ":full-of-friends-2:", says: "Unlocks at 25" });
  });

  it("#707: before the album answers a tier's emoji, shows the tier's picture under the slug of its name and offers nothing to add", async () => {
    visit(withoutMilestoneEmojis(midway));

    expect(emojiIn(await medalNamed("Earned", "Familiar faces"))).toEqual({ picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "" });
    expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("#707: getAlbum's answer as the code before #707 built it, gold only under milestone:<id>, still shows every medal's own picture under its tier's slug and offers nothing to add", async () => {
    visit(answeredBeforeEveryTier(midway));

    expect(emojiIn(await medalNamed("Earned", "Familiar faces"))).toEqual({ picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "" });
    expect(emojiIn(await medalNamed("Closest medals", "Full of friends"))).toEqual({ picture: "/emoji/milestone-people-gold.png", name: ":full-of-friends:", earned: false, says: "Unlocks at 25" });
    expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("#707, AL31: an earned emoji Slack doesn't have offers Add to Slack, which saves its picture as <name>.png and opens the workspace's custom emoji page", async () => {
    const saved = savedPictures();
    const { user } = visit();

    vi.spyOn(window, "open").mockReturnValue(null);
    await user.click((await medalNamed("Earned", "Familiar faces")).getByRole("button", { name: "Add to Slack: :familiar-faces:" }));

    await waitFor(() => expect(saved).toEqual([{ href: "/emoji/milestone-people-silver.png", download: "familiar-faces.png" }]));
    expect(window.open).toHaveBeenCalledExactlyOnceWith("https://hedgehug.slack.com/customize/emoji", "_blank", "noopener,noreferrer");
  });

  it("#707, AL30: a locked emoji never says it is in Slack or offers to add it, even where Slack already has its name", async () => {
    const gold: AlbumEmoji = { id: "milestone:people:gold", kind: "milestone", name: "full-of-friends", from: "Full of friends", picture: "/emoji/milestone-people-gold.png", earned: false, earnedAt: null, seen: false, inSlack: true, progress: { have: 12, need: 25 } };
    visit(withEmoji(midway, gold));

    expect(emojiIn(await medalNamed("Closest medals", "Full of friends"))).toMatchObject({ earned: false, says: "Unlocks at 25" });
  });
});
