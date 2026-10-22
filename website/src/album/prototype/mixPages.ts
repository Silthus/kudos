// PROTOTYPE: one page model for your own page and a teammate's, so both render the same layout.
import type { Album, AlbumEmoji, AlbumHoggies, AlbumLevel, AlbumPet, AlbumProfile, AlbumTeam, AlbumWeek, FoundHoggie, PeopleListed, PersonPage, ThoughtfulBoards, WeekKudosList, WeekPerson } from "../answer";
import { earnedEmojisOf, medalsOf, myTeamOf } from "../facts";
import { petOf } from "../PetHoggie";
import { bestMedalsOf, peopleGlanceOf, type BestMedal } from "../profile";

export type MixPage = {
  own: boolean;
  person: string;
  name: string;
  face: WeekPerson["face"];
  pet: AlbumPet | null;
  team: AlbumTeam | undefined;
  level: AlbumLevel;
  rank: { rank: number; tied: boolean } | null;
  thoughtful: number;
  gapAbove: { name: string; gap: number } | null;
  hoggies: { found: number; total: number; rarest: FoundHoggie[] };
  people: { held: number; total: number };
  faces: WeekPerson[];
  emojis: AlbumEmoji[];
  emojiCount: number;
  medals: BestMedal[];
  medalCount: number;
  week: AlbumWeek;
  together: PersonPage | null;
};

type OwnReads = { album: Album; profile: AlbumProfile; boards: ThoughtfulBoards; hoggies: AlbumHoggies | null; week: AlbumWeek };

export function ownPageOf({ album, profile, boards, hoggies, week }: OwnReads): MixPage {
  const me = boards.pinned.me;
  const rank = boards.onTheBoards && me !== null && me.rank !== null ? { rank: me.rank, tied: me.tied } : null;
  const above = rank === null ? null : (boards.people.filter((person) => person.rank !== null && person.rank < rank.rank).at(-1) ?? null);
  return {
    own: true,
    person: album.me.person,
    name: album.me.name,
    face: album.me.face,
    pet: petOf(album, album.me.person),
    team: myTeamOf(album),
    level: album.level,
    rank,
    thoughtful: me?.thoughtful ?? 0,
    gapAbove: above === null || me === null ? null : { name: above.name, gap: Math.max(1, above.thoughtful - me.thoughtful + 1) },
    hoggies: { found: hoggies?.found ?? 0, total: hoggies?.total ?? 0, rarest: (hoggies?.rarest ?? []) as FoundHoggie[] },
    people: peopleGlanceOf(album),
    faces: profile.newest.map(({ person, name, face }) => ({ person, name, face })),
    emojis: album.emojis.filter(({ earned }) => earned),
    emojiCount: earnedEmojisOf(album),
    medals: bestMedalsOf(album),
    medalCount: medalsOf(album),
    week,
    together: null,
  };
}

type VisitReads = { album: Album; person: PersonPage; hoggies: AlbumHoggies; week: AlbumWeek; level: AlbumLevel; pet: AlbumPet | null };

export function visitPageOf({ album, person, hoggies, week, level, pet }: VisitReads): MixPage {
  const found = hoggies.rarest as FoundHoggie[];
  const favourite = found[2];
  return {
    own: false,
    person: person.person,
    name: person.name,
    face: person.face,
    pet,
    team: album.teams.find(({ team }) => team === person.teams[0]?.team),
    level,
    rank: { rank: 1, tied: false },
    thoughtful: 7,
    gapAbove: null,
    hoggies: { found: 64, total: hoggies.total, rarest: favourite === undefined ? found : [favourite, ...found.filter((hoggie) => hoggie !== favourite)] },
    people: { held: 24, total: album.people.length },
    faces: album.people.filter(({ held }) => held).slice(0, 4).map(({ person: slug, name, face }) => ({ person: slug, name, face })),
    emojis: album.emojis.filter(({ earned }) => earned).slice(0, 7),
    emojiCount: 7,
    medals: bestMedalsOf(album).slice(0, 2),
    medalCount: 4,
    week: weekSeenFrom(week, person.person, album.me),
    together: person,
  };
}

function weekSeenFrom(week: AlbumWeek, visited: string, me: WeekPerson): AlbumWeek {
  const swap = (someone: WeekPerson) => (someone.person === visited ? me : someone);
  const listed = ({ people, more }: PeopleListed) => ({ people: people.map(swap), more });
  const said = ({ kudos, more }: WeekKudosList) => ({ kudos: kudos.map((one) => ({ ...one, people: one.people.map(swap) })), more });
  const { issue } = week;
  if (issue === null) return week;
  return {
    ...week,
    issue: {
      ...issue,
      kudosOfWeek: issue.kudosOfWeek === null ? null : { ...issue.kudosOfWeek, giver: swap(issue.kudosOfWeek.giver) },
      thanked: listed(issue.thanked),
      thankedBy: listed(issue.thankedBy),
      hugged: listed(issue.hugged),
      huggedBy: listed(issue.huggedBy),
      newFaces: listed(issue.newFaces),
      given: said(issue.given),
      received: said(issue.received),
    },
  };
}
