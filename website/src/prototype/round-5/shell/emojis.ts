// PROTOTYPE (#625, round 6): your emojis by kind: which you have, the nearest few you could unlock next and how, and which are owed a moment. Never merge to main.
import { personOf, type Album, type Emoji } from "../../round-3/album";
import { firstNameOf } from "./motion";

export type EmojiKind = Emoji["source"]["kind"];

export type Kind = { kind: EmojiKind; title: string; hint: string; firstLocked: number };

export const kinds: Kind[] = [
  { kind: "team", title: "Team stickers", hint: "Collect everyone on a team, then unlock its sticker.", firstLocked: 4 },
  { kind: "hype", title: "Hype", hint: "Thank anyone for the first time to unlock theirs.", firstLocked: 3 },
  { kind: "milestone", title: "Milestones", hint: "Reach gold in a milestone.", firstLocked: 5 },
  { kind: "level", title: "Levels", hint: "One every five levels.", firstLocked: 5 },
];

const firstUnlocked = 8;

export type Shelf = { kind: Kind; unlocked: Emoji[]; locked: Emoji[]; total: number };

export function ofKind(album: Album, kind: EmojiKind) {
  return album.emojis.filter(({ source }) => source.kind === kind);
}

export function shownCountOf(album: Album) {
  return album.emojis.filter(({ unlocked, seen }) => unlocked && seen).length;
}

export function anyUnseen(album: Album) {
  return album.emojis.some(({ unlocked, seen }) => unlocked && !seen);
}

function heldForItsPack(album: Album, emoji: Emoji) {
  const { source } = emoji;
  return source.kind === "hype" && album.packs.some(({ person }) => person === source.person);
}

export function owedOf(album: Album) {
  return album.emojis.filter((emoji) => emoji.unlocked && !emoji.seen && !heldForItsPack(album, emoji));
}

export function hypeOwedFor(album: Album, person: string) {
  return album.emojis.find(({ id, unlocked, seen }) => id === `hype:${person}` && unlocked && !seen) ?? null;
}

function shareOf({ progress }: Emoji) {
  return progress === null ? 0 : progress.have / progress.need;
}

function byNearest(first: Emoji, second: Emoji) {
  return shareOf(second) - shareOf(first) || first.label.localeCompare(second.label);
}

function thankedAt(album: Album, emoji: Emoji) {
  return emoji.source.kind === "hype" ? (personOf(album, emoji.source.person)?.stats.firstThankedAt ?? 0) : 0;
}

function teamsStarted(album: Album) {
  return new Set(album.teams.filter(({ held }) => held > 0).map(({ team }) => team));
}

function hypeNearby(album: Album, locked: Emoji[]) {
  const started = teamsStarted(album);
  const progressOf = (emoji: Emoji) => {
    const person = emoji.source.kind === "hype" ? personOf(album, emoji.source.person) : undefined;
    const teams = album.teams.filter(({ team }) => person?.teams.includes(team) && started.has(team));
    return Math.max(0, ...teams.map(({ held, total }) => held / total));
  };
  return locked.filter((emoji) => progressOf(emoji) > 0).toSorted((first, second) => progressOf(second) - progressOf(first) || first.label.localeCompare(second.label));
}

export function shelfOf(album: Album, kind: Kind): Shelf {
  const all = ofKind(album, kind.kind);
  const unlocked = all.filter((emoji) => emoji.unlocked).toSorted((first, second) => thankedAt(album, second) - thankedAt(album, first));
  const notYet = all.filter(({ unlocked: has }) => !has);
  const locked = kind.kind === "hype" ? hypeNearby(album, notYet) : kind.kind === "level" ? notYet : notYet.toSorted(byNearest);
  return { kind, unlocked, locked, total: all.length };
}

export function firstFewOf(shelf: Shelf) {
  return { unlocked: shelf.unlocked.slice(0, firstUnlocked), locked: shelf.locked.slice(0, shelf.kind.firstLocked) };
}

export function matches(album: Album, emoji: Emoji, search: string) {
  const words = search.trim().toLowerCase();
  return [emoji.name, emoji.label, progressWordsOf(album, emoji)].some((text) => text.toLowerCase().includes(words));
}

function teamNameOf(album: Album, team: string) {
  return album.teams.find((entry) => entry.team === team)?.name ?? team;
}

function milestoneNameOf(album: Album, milestone: string) {
  return album.milestones.find(({ id }) => id === milestone)?.name ?? milestone;
}

function personFirstNameOf(album: Album, person: string) {
  return firstNameOf(personOf(album, person)?.name ?? "them");
}

function number(value: number) {
  return value.toLocaleString("en");
}

export function readyToClaim(emoji: Emoji) {
  return emoji.source.kind === "team" && !emoji.unlocked && emoji.progress !== null && emoji.progress.have === emoji.progress.need;
}

export function progressWordsOf(album: Album, emoji: Emoji) {
  const { source, progress } = emoji;
  const have = progress?.have ?? 0;
  const need = progress?.need ?? 0;
  if (source.kind === "team") return readyToClaim(emoji) ? `${teamNameOf(album, source.team)} · all ${need} in, unlock the sticker on its page` : `${teamNameOf(album, source.team)} · ${have} of ${need} people`;
  if (source.kind === "milestone") return `Gold in ${milestoneNameOf(album, source.milestone)} · ${have} of ${need}`;
  if (source.kind === "level") return `Level ${source.level} · ${number(have)} / ${number(need)} XP`;
  return `Thank ${personFirstNameOf(album, source.person)} for the first time`;
}

export function whyOf(album: Album, emoji: Emoji) {
  const { source } = emoji;
  if (source.kind === "team") return `You unlocked the ${teamNameOf(album, source.team)} sticker`;
  if (source.kind === "milestone") return `Gold in ${milestoneNameOf(album, source.milestone)}`;
  if (source.kind === "level") return `You reached level ${source.level}`;
  return `You thanked ${personFirstNameOf(album, source.person)} for the first time`;
}

export const usageWords = "Use it in Slack: react with it or put it in a kudos.";
