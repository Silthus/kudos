import type { AlbumPack, AlbumPerson as HeldPerson, AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import type { Denial } from "../../../convex/website/memberQuery";
import type { AlbumEmoji, AlbumPerson, AlbumTeam, MyAlbum, SharedEmoji, WaitingPack } from "./answer";

export function albumOf(answer: GetAlbumAnswer | Denial): MyAlbum {
  if (answer.kind !== "album") return answer;
  const { people, morePeople, packs, milestones = [], emojis = [], moreEmojis = false, sharedEmojis = null, emojiPage = null, ...answered } = answer;
  return { gettingStarted: null, ...answered, milestones, emojis: emojis.map(withItsSource), moreEmojis, sharedEmojis: sharedEmojis?.map(withItsName) ?? null, emojiPage, people: people.map((person) => onTheirTeams(person, answer.teams)), packs: packs.map((pack) => withWhomItThanks(pack, people)), me: { team: null, ...answer.me } };
}

type AnsweredPack = Omit<AlbumPack, "thanked"> & Partial<Pick<AlbumPack, "thanked">>;

function withWhomItThanks({ thanked, ...pack }: AnsweredPack, people: HeldPerson[]): WaitingPack {
  const listed = people.find(({ person }) => person === pack.person);
  return { ...pack, thanked: thanked ?? { name: listed?.name ?? null, face: listed?.face ?? null } };
}

type AnsweredEmoji = Omit<AlbumEmoji, "from" | "earnedAt"> & Partial<Pick<AlbumEmoji, "from" | "earnedAt">>;

function withItsSource({ from, earnedAt, ...emoji }: AnsweredEmoji): AlbumEmoji {
  return { ...emoji, from: from ?? emoji.name, earnedAt: earnedAt ?? null };
}

function withItsName({ from, ...emoji }: Omit<SharedEmoji, "from"> & Partial<Pick<SharedEmoji, "from">>): SharedEmoji {
  return { ...emoji, from: from ?? emoji.name };
}

function onTheirTeams(person: HeldPerson, teams: AlbumTeam[]): AlbumPerson {
  return { ...person, teams: teams.filter(({ people }) => people.includes(person.person)).map(({ team }) => team), packedThisWeek: false };
}
