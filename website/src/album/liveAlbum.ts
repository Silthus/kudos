import type { AlbumPerson as HeldPerson, AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import type { Denial } from "../../../convex/website/memberQuery";
import type { AlbumEmoji, AlbumPerson, AlbumTeam, MyAlbum, PutAllInReply, PutInReply, SharedEmoji, Thanked, TrayItem, WaitingPack } from "./answer";

export function albumOf(answer: GetAlbumAnswer | Denial): MyAlbum {
  if (answer.kind !== "album") return answer;
  const { people, morePeople, packs, tray, milestones = [], emojis = [], moreEmojis = false, sharedEmojis = null, emojiPage = null, ...answered } = answer;
  return { gettingStarted: null, ...answered, packs: packs.map(packShown), tray: tray.map(itemShown), milestones, emojis: emojis.map(withItsSource), moreEmojis, sharedEmojis: sharedEmojis?.map(withItsName) ?? null, emojiPage, people: people.map((person) => onTheirTeams(person, answer.teams)), me: { team: null, ...answer.me } };
}

const nobodyNamed: Thanked = { name: null, face: null };

type AnsweredPack = Omit<WaitingPack, "thanked"> & Partial<Pick<WaitingPack, "thanked">>;

type AnsweredItem = Exclude<TrayItem, { kind: "sticker" }> | (Omit<Extract<TrayItem, { kind: "sticker" }>, "thanked"> & Partial<Pick<TrayItem & { kind: "sticker" }, "thanked">>);

function packShown({ thanked = nobodyNamed, ...pack }: AnsweredPack): WaitingPack {
  return { ...pack, thanked };
}

function itemShown(item: AnsweredItem): TrayItem {
  if (item.kind === "hoggie") return item;
  const { thanked = nobodyNamed, ...sticker } = item;
  return { ...sticker, thanked };
}

export function putInShown(reply: PutInReply): PutInReply {
  return reply.kind === "placed" ? { ...reply, item: itemShown(reply.item) } : reply;
}

export function putAllInShown(reply: PutAllInReply): PutAllInReply {
  return reply.kind === "placed" ? { ...reply, items: reply.items.map(itemShown) } : reply;
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
