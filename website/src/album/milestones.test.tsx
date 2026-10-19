import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import answeredBefore707 from "./milestonesAnsweredBefore707.json";
import type { Album, AlbumEmoji, AlbumMilestone } from "./answer";

const arrival = 10_000;

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

const midway = albumFixtures.midway;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(album: Album = midway) {
  window.history.replaceState(null, "", "/book#milestones");
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album));
}

async function rowOf(name: string) {
  return within(await screen.findByRole("listitem", { name }, { timeout: arrival }));
}

function medalsIn(row: ReturnType<typeof within>): HTMLElement[] {
  return row.getAllByRole("listitem");
}

function medalWordsIn(row: ReturnType<typeof within>): [string | null, string | null][] {
  return medalsIn(row).map((medal) => [medal.getAttribute("data-step"), textOutsideTheEmoji(medal)]);
}

function textOutsideTheEmoji(medal: HTMLElement) {
  return [...medal.children].filter((part) => part.tagName !== "FIGURE").map((part) => part.textContent).join("");
}

function emojisUnder(row: ReturnType<typeof within>) {
  return medalsIn(row).map((medal) => {
    const emoji = within(medal).getByRole("figure");
    return { picture: emoji.querySelector("img")?.getAttribute("src"), name: within(emoji).getByText(/^:.+:$/).textContent, earned: emoji.hasAttribute("data-earned"), says: emoji.querySelector(".al-ms-emoji-says")?.textContent };
  });
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

describe("AL51: Milestones shows one row per milestone with its four medals and the emoji each one unlocks", { timeout: 60_000 }, () => {
  it("lists the five milestones in the catalogue's order, each saying what it counts in plain words and the next goal", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Milestones" }, { timeout: arrival })).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Your milestones" })).getAllByRole("listitem", { name: /./ });
    expect(rows.map((row) => row.querySelector("h3")?.textContent)).toEqual(["Faces in the album", "Full pages", "Across the company", "Hoggie hunter", "Kind words"]);

    const faces = await rowOf("Faces in the album");
    expect(faces.getByText("people in your album").parentElement).toHaveTextContent("12 people in your album");
    expect(faces.getByText("13 to go for Full of friends")).toBeInTheDocument();
    expect((await rowOf("Full pages")).getByText("team sticker unlocked").parentElement).toHaveTextContent("1 team sticker unlocked");
    expect((await rowOf("Across the company")).getByText("teams with someone in your album").parentElement).toHaveTextContent("6 teams with someone in your album");
    expect((await rowOf("Hoggie hunter")).getByText("hoggies found").parentElement).toHaveTextContent("18 hoggies found");
    expect((await rowOf("Kind words")).getByText("thoughtful kudos given").parentElement).toHaveTextContent("9 thoughtful kudos given");
  });

  it("reads its four medals bronze to diamond: earned ones in metal with their dates, the next lit with its progress, later ones faint at their step", async () => {
    visit();

    const faces = await rowOf("Faces in the album");
    expect(faces.getByRole("list", { name: "Faces in the album medals, bronze to diamond" })).toBeInTheDocument();
    expect(medalWordsIn(faces)).toEqual([
      ["earned", "BronzeFirst face28 Sept 2026"],
      ["earned", "SilverFamiliar faces16 Oct 2026"],
      ["next", "NextGoldFull of friends12 of 25"],
      ["later", "DiamondEveryone's album"],
    ]);
    expect(faces.getByRole("progressbar", { name: "Full of friends" })).toHaveAttribute("aria-valuenow", "12");
    expect(faces.getByRole("progressbar", { name: "Full of friends" })).toHaveAttribute("aria-valuemax", "25");
  });

  it("a milestone with every medal says so with nothing lit", async () => {
    const tiersAllEarned = midway.milestones.find(({ id }) => id === "thoughtful")!.tiers.map((tier) => ({ ...tier, earnedAt: now - day }));
    visit(withMilestone(midway, { id: "thoughtful", count: 512, tiers: tiersAllEarned }));

    const kind = await rowOf("Kind words");
    expect(kind.getByText("Every medal earned")).toBeInTheDocument();
    expect(medalsIn(kind).map((medal) => medal.getAttribute("data-step"))).toEqual(["earned", "earned", "earned", "earned"]);
    expect(kind.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("heads the page with the medals earned of all twenty and the closest next medal, with no Collected strip and no just-earned band", async () => {
    visit();

    expect(await screen.findByText("of 20 medals", undefined, { timeout: arrival })).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("6 of 20 medals");
    expect(screen.getByText(/^Closest:/)).toHaveTextContent("Closest: Bridge builder, 4 to go · Silver · Across the company");
    expect(screen.queryByText(/Collected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/just earned/i)).not.toBeInTheDocument();
  });

  it("a newcomer sees every bronze lit as the next goal", async () => {
    visit(albumFixtures.newcomer);

    const faces = await rowOf("Faces in the album");
    expect(medalsIn(faces).map((medal) => medal.getAttribute("data-step"))).toEqual(["next", "later", "later", "later"]);
    expect(faces.getByText("1 to go for First face")).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("0 of 20 medals");
  });

  it("before the album answers its milestones, says where they will show", async () => {
    visit({ ...midway, milestones: [] });

    expect(await screen.findByText("Your milestones show here once your album starts filling.", undefined, { timeout: arrival })).toBeInTheDocument();
  });
  it("#707: under every medal, shows its tier's emoji picture and name, earned tiers in colour and locked tiers greyed out with the step that unlocks them", async () => {
    visit();

    expect(emojisUnder(await rowOf("Faces in the album"))).toEqual([
      { picture: "/emoji/milestone-people-bronze.png", name: ":first-face:", earned: true, says: "In Slack" },
      { picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "Add to Slack" },
      { picture: "/emoji/milestone-people-gold.png", name: ":full-of-friends:", earned: false, says: "Unlocks at 25" },
      { picture: "/emoji/milestone-people-diamond.png", name: ":everyone-s-album:", earned: false, says: "Unlocks at 50" },
    ]);
  });

  it("#707: names each emoji as the album's earned emojis name it, so a name the registry numbered shows numbered", async () => {
    const numbered: AlbumEmoji = { id: "milestone:people:gold", kind: "milestone", name: "full-of-friends-2", from: "Full of friends", picture: "/emoji/milestone-people-gold.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 12, need: 25 } };
    visit(withEmoji(midway, numbered));

    expect(emojisUnder(await rowOf("Faces in the album"))[2]).toMatchObject({ name: ":full-of-friends-2:", says: "Unlocks at 25" });
  });

  it("#707: before the album answers a tier's emoji, shows the tier's picture under the slug of its name and offers nothing to add", async () => {
    visit(withoutMilestoneEmojis(midway));

    const faces = await rowOf("Faces in the album");
    expect(emojisUnder(faces)[1]).toEqual({ picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "" });
    expect(faces.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("#707: getAlbum's answer as the code before #707 built it, gold only under milestone:<id>, still shows every medal's own picture under its tier's slug and offers nothing to add", async () => {
    visit(answeredBeforeEveryTier(midway));

    const faces = await rowOf("Faces in the album");
    expect(emojisUnder(faces)).toEqual([
      { picture: "/emoji/milestone-people-bronze.png", name: ":first-face:", earned: true, says: "" },
      { picture: "/emoji/milestone-people-silver.png", name: ":familiar-faces:", earned: true, says: "" },
      { picture: "/emoji/milestone-people-gold.png", name: ":full-of-friends:", earned: false, says: "Unlocks at 25" },
      { picture: "/emoji/milestone-people-diamond.png", name: ":everyone-s-album:", earned: false, says: "Unlocks at 50" },
    ]);
    expect(screen.queryByRole("button", { name: /^Add to Slack/ })).not.toBeInTheDocument();
  });

  it("#707, AL31: an earned emoji Slack doesn't have offers Add to Slack, which saves its picture as <name>.png and opens the workspace's custom emoji page", async () => {
    const saved = savedPictures();
    const { user } = visit();

    vi.spyOn(window, "open").mockReturnValue(null);
    await user.click((await rowOf("Faces in the album")).getByRole("button", { name: "Add to Slack: :familiar-faces:" }));

    await waitFor(() => expect(saved).toEqual([{ href: "/emoji/milestone-people-silver.png", download: "familiar-faces.png" }]));
    expect(window.open).toHaveBeenCalledExactlyOnceWith("https://hedgehug.slack.com/customize/emoji", "_blank", "noopener,noreferrer");
  });

  it("#707, AL30: a locked emoji never says it is in Slack or offers to add it, even where Slack already has its name", async () => {
    const gold: AlbumEmoji = { id: "milestone:people:gold", kind: "milestone", name: "full-of-friends", from: "Full of friends", picture: "/emoji/milestone-people-gold.png", earned: false, earnedAt: null, seen: false, inSlack: true, progress: { have: 12, need: 25 } };
    visit(withEmoji(midway, gold));

    expect(emojisUnder(await rowOf("Faces in the album"))[2]).toMatchObject({ earned: false, says: "Unlocks at 25" });
  });
});
