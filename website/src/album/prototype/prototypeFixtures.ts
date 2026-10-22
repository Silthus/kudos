// PROTOTYPE fixtures: one rich and one quiet made-up member for the person-page variants.
import type { AppReads } from "../../App";
import { albumFixtures, fixedAlbum } from "../albumFixtures";
import type { Album, AlbumLevel, AlbumPet, AlbumWeek, ThoughtfulBoards } from "../answer";
import { boardsFixtures, fixedBoards } from "../boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "../hoggiesFixtures";
import { fixedProfile, profileFixtures } from "../profileFixtures";
import { weekFixtures } from "../weekFixtures";
import type { PrototypeMember } from "./personPagePrototype";

const started = albumFixtures.started;

const rich: Album = {
  ...started,
  level: { level: 6, xp: 1210, startsAt: 1000, nextAt: 1500 },
  pets: [{ person: started.me.person as never, hoggie: "coffee-run", name: "Coffee Run", rarity: "rare" }],
  linkPreviews: true,
};

const weekBoards = boardsFixtures.week;

const richMe = { ...weekBoards.pinned.me!, rank: 2, tied: false as const, thoughtful: 5 };

const richBoards: ThoughtfulBoards = {
  ...weekBoards,
  people: [weekBoards.people[0]!, richMe, ...weekBoards.people.slice(2).filter(({ you }) => !you)],
  pinned: { ...weekBoards.pinned, me: richMe },
};

const newcomer = albumFixtures.newcomer;

const quiet: Album = {
  ...newcomer,
  me: { ...newcomer.me, team: "lanterns" },
  teams: newcomer.teams.map((team) => ({ ...team, mine: team.team === "lanterns" })),
  level: { level: 1, xp: 15, startsAt: 0, nextAt: 100 },
  emojis: newcomer.emojis.map((emoji) => ({ ...emoji, progress: emoji.progress === null ? null : { ...emoji.progress, have: 0 } })),
  linkPreviews: true,
};

const quietBoards: ThoughtfulBoards = { ...boardsFixtures.quiet, pinned: { me: boardsFixtures.quiet.pinned.me, teams: boardsFixtures.quiet.pinned.teams.slice(0, 1) } };

export function prototypeReadsOf(member: PrototypeMember): Pick<AppReads, "useAlbum" | "useThoughtfulBoards" | "useAlbumProfile" | "useAlbumHoggies"> {
  if (member === "quiet") return { useAlbum: fixedAlbum(quiet), useThoughtfulBoards: fixedBoards(quietBoards), useAlbumProfile: fixedProfile(profileFixtures.quiet), useAlbumHoggies: fixedHoggies(hoggiesFixtures.newcomer) };
  return { useAlbum: fixedAlbum(rich), useThoughtfulBoards: fixedBoards(richBoards), useAlbumProfile: fixedProfile(profileFixtures.noted), useAlbumHoggies: fixedHoggies(hoggiesFixtures.midway) };
}

export function prototypeWeekOf(member: PrototypeMember): AlbumWeek {
  return member === "quiet" ? weekFixtures.noHistory : weekFixtures.full;
}

export const visitedHoggies = hoggiesFixtures.midway;

export const visitedLevel: AlbumLevel = { level: 8, xp: 2310, startsAt: 2100, nextAt: 2800 };

export function visitedPetOf(person: string): AlbumPet {
  return { person: person as never, hoggie: "banana", name: "Banana", rarity: "common" };
}
