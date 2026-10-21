// PROTOTYPE (personal#97): the face-down items on the board, and the fixture album they land in. Made-up people only. Never merge to main.
import { useSyncExternalStore } from "react";
import type { Rarity } from "../../shell";
import { albumFixtures } from "../albumFixtures";
import type { Album, AlbumHoggies, AlbumRead, HoggiesRead } from "../answer";
import { hoggiesFixtures } from "../hoggiesFixtures";
import { hrefOf } from "../place";

type Common = { id: string; xp: number; page: string; target: string; source: string };

export type BoardItem =
  | (Common & { kind: "sticker"; person: string; name: string; initials: string; team: string })
  | (Common & { kind: "hoggie"; hoggie: string; name: string; rarity: Rarity; isNew: boolean })
  | (Common & { kind: "emoji"; emoji: string; name: string; picture: string; from: string });

const thanks = 15;

const album = albumFixtures.trayed;

const hoggies = hoggiesFixtures.midway;

function sticker(person: string, team: string, source: string): BoardItem {
  const listed = album.people.find((one) => one.person === person)!;
  const name = listed.name;
  const initials = listed.face.kind === "initials" ? listed.face.initials : name.slice(0, 2);
  return { id: `sticker:${person}`, kind: "sticker", person, name, initials, team, xp: thanks, page: hrefOf({ kind: "team", team }), target: `.al-photo-link[href$="people/${person}"] .al-photo-sticker`, source };
}

function hoggieOf(rarity: Rarity, skip: number, source: string): BoardItem {
  const missing = hoggies.hoggies.filter((one) => !one.found && one.rarity === rarity)[skip]!;
  return { id: `hoggie:${missing.hoggie}`, kind: "hoggie", hoggie: missing.hoggie, name: missing.name, rarity, isNew: true, xp: 0, page: hrefOf({ kind: "hoggies", hoggie: null }), target: `[data-hoggie="${missing.hoggie}"] .al-hoggies-plate-art`, source };
}

function emojiOf(id: string, source: string): BoardItem {
  const known = album.emojis.find((one) => one.id === id)!;
  return { id: `emoji:${id}`, kind: "emoji", emoji: id, name: `:${known.name}:`, picture: known.picture, from: known.from, xp: 0, page: "", target: ".al-emojis", source };
}

export const boardItems: BoardItem[] = [
  sticker("juno-park", "lanterns", "For thanking Juno Park"),
  hoggieOf("rare", 0, "For thanking Juno Park"),
  sticker("rook-dale", "paper-moons", "For thanking Rook Dale"),
  hoggieOf("common", 0, "For thanking Rook Dale"),
  hoggieOf("common", 1, "Level 6"),
  hoggieOf("uncommon", 0, "Level 6"),
  hoggieOf("epic", 0, "Level 6"),
  emojiOf("team:lanterns", "Lanterns is complete"),
  emojiOf("team:copper-kite", "A random emoji"),
];

const listeners = new Set<() => void>();

type Progress = { landed: ReadonlySet<string>; paid: ReadonlySet<string> };

let progress: Progress = { landed: new Set(), paid: new Set() };

function change(next: Progress) {
  progress = next;
  listeners.forEach((listener) => listener());
}

export function land(id: string) {
  change({ ...progress, landed: new Set(progress.landed).add(id) });
}

export function pay(id: string) {
  change({ ...progress, paid: new Set(progress.paid).add(id) });
}

export function startOver() {
  change({ landed: new Set(), paid: new Set() });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress() {
  return useSyncExternalStore(subscribe, () => progress);
}

function itemsIn(ids: ReadonlySet<string>) {
  return boardItems.filter(({ id }) => ids.has(id));
}

const albums = new WeakMap<Progress, Album>();

function albumWith(now: Progress): Album {
  const known = albums.get(now);
  if (known !== undefined) return known;
  const items = itemsIn(now.landed);
  const people = new Set(items.flatMap((item) => (item.kind === "sticker" ? [item.person] : [])));
  const emojis = new Set(items.flatMap((item) => (item.kind === "emoji" ? [item.emoji] : [])));
  const xp = itemsIn(now.paid).reduce((sum, item) => sum + item.xp, 0);
  const shown: Album = {
    ...album,
    packs: [],
    tray: [],
    level: { ...album.level, xp: album.level.xp + xp },
    people: album.people.map((person) => (people.has(person.person) ? { ...person, held: true } : person)),
    teams: album.teams.map((team) => ({ ...team, held: Math.min(team.total, team.held + team.people.filter((person) => people.has(person)).length) })),
    emojis: album.emojis.map((emoji) => (emojis.has(emoji.id) ? { ...emoji, earned: true, earnedAt: Date.now(), seen: true, progress: null } : emoji)),
  };
  albums.set(now, shown);
  return shown;
}

const hoggieAnswers = new WeakMap<ReadonlySet<string>, AlbumHoggies>();

function hoggiesWith(ids: ReadonlySet<string>): AlbumHoggies {
  const known = hoggieAnswers.get(ids);
  if (known !== undefined) return known;
  const found = new Set(itemsIn(ids).flatMap((item) => (item.kind === "hoggie" ? [item.hoggie] : [])));
  const list = hoggies.hoggies.map((one) => (found.has(one.hoggie) ? { ...one, found: true, count: 1, firstAt: Date.now() } : one));
  const shown = { ...hoggies, hoggies: list, found: hoggies.found + found.size, rarities: hoggies.rarities.map((shelf) => ({ ...shelf, found: shelf.found + list.filter((one) => found.has(one.hoggie) && one.rarity === shelf.rarity).length })) };
  hoggieAnswers.set(ids, shown);
  return shown;
}

export const useItemBoardAlbum: AlbumRead = (asking) => {
  const now = useProgress();
  return asking ? albumWith(now) : undefined;
};

export const useItemBoardHoggies: HoggiesRead = (asking) => {
  const { landed } = useProgress();
  return asking ? hoggiesWith(landed) : undefined;
};
