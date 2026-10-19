import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
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

function medalsIn(row: ReturnType<typeof within>): [string | null, string | null][] {
  return row.getAllByRole("listitem").map((medal: HTMLElement) => [medal.getAttribute("data-step"), medal.textContent]);
}

function withMilestone(album: Album, milestone: AlbumMilestone): Album {
  return { ...album, milestones: album.milestones.map((listed) => (listed.id === milestone.id ? milestone : listed)) };
}

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

describe("AL51: Milestones shows one row per milestone with its four medals", { timeout: 60_000 }, () => {
  it("lists the five milestones in the catalogue's order, each saying what it counts in plain words and the next goal", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Milestones" }, { timeout: arrival })).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Your milestones" })).getAllByRole("listitem", { name: /./ });
    expect(rows.map((row) => row.querySelector("h3")?.textContent)).toEqual(["Faces in the album", "Full pages", "Across the company", "Hoggie hunter", "Kind words"]);

    const faces = await rowOf("Faces in the album");
    expect(faces.getByText("people in your album").parentElement).toHaveTextContent("12 people in your album");
    expect(faces.getByText("13 to go for Full of friends")).toBeInTheDocument();
    expect((await rowOf("Full pages")).getByText("team sticker unlocked").parentElement).toHaveTextContent("1 team sticker unlocked");
    expect((await rowOf("Across the company")).getByText("teams you've collected someone from").parentElement).toHaveTextContent("6 teams you've collected someone from");
    expect((await rowOf("Hoggie hunter")).getByText("hoggies found").parentElement).toHaveTextContent("18 hoggies found");
    expect((await rowOf("Kind words")).getByText("thoughtful kudos given").parentElement).toHaveTextContent("9 thoughtful kudos given");
  });

  it("reads its four medals bronze to diamond: earned ones in metal with their dates, the next lit with its progress, later ones faint at their step", async () => {
    visit();

    const faces = await rowOf("Faces in the album");
    expect(faces.getByRole("list", { name: "Faces in the album medals, bronze to diamond" })).toBeInTheDocument();
    expect(medalsIn(faces)).toEqual([
      ["earned", "BronzeFirst face28 Sept 2026"],
      ["earned", "SilverFamiliar faces16 Oct 2026"],
      ["next", "NextGoldFull of friends12 of 25"],
      ["later", "DiamondEveryone's albumAt 50"],
    ]);
    expect(faces.getByRole("progressbar", { name: "Full of friends" })).toHaveAttribute("aria-valuenow", "12");
    expect(faces.getByRole("progressbar", { name: "Full of friends" })).toHaveAttribute("aria-valuemax", "25");
  });

  it("names the emoji each milestone's gold gives, as the album's earned emojis name it once they carry it", async () => {
    const goldEmoji: AlbumEmoji = { id: "milestone:people", kind: "milestone", name: "full-of-friends-2", picture: "/emoji/milestone-people.png", earned: false, seen: false, inSlack: false, progress: { have: 12, need: 25 } };
    visit({ ...midway, emojis: [...midway.emojis, goldEmoji] });

    expect((await rowOf("Faces in the album")).getByText(":full-of-friends-2:").parentElement).toHaveTextContent("Gold unlocks :full-of-friends-2:");
    expect((await rowOf("Kind words")).getByText(":heart-of-the-team:").parentElement).toHaveTextContent("Gold unlocks :heart-of-the-team:");
  });

  it("says the gold emoji is unlocked once gold is earned, and a milestone with every medal says so with nothing lit", async () => {
    const tiersAllEarned = midway.milestones.find(({ id }) => id === "thoughtful")!.tiers.map((tier) => ({ ...tier, earnedAt: now - day }));
    visit(withMilestone(midway, { id: "thoughtful", count: 512, tiers: tiersAllEarned }));

    const kind = await rowOf("Kind words");
    expect(kind.getByText(":heart-of-the-team:").parentElement).toHaveTextContent("Gold unlocked :heart-of-the-team:");
    expect(kind.getByText("Every medal earned")).toBeInTheDocument();
    expect(medalsIn(kind).map(([step]) => step)).toEqual(["earned", "earned", "earned", "earned"]);
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
    expect(medalsIn(faces).map(([step]) => step)).toEqual(["next", "later", "later", "later"]);
    expect(faces.getByText("1 to go for First face")).toBeInTheDocument();
    expect(screen.getByText("of 20 medals").parentElement).toHaveTextContent("0 of 20 medals");
  });

  it("before the album answers its milestones, says where they will show", async () => {
    visit({ ...midway, milestones: [] });

    expect(await screen.findByText("Your milestones show here once your album starts filling.", undefined, { timeout: arrival })).toBeInTheDocument();
  });
});
