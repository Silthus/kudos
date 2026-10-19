import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { Album, AlbumEmoji, EarnedEmojiKind } from "./answer";
import { milestoneNameOf } from "./milestones";
import { dateOf, firstNameOf } from "./teamPage";

export type ShelfKind = { kind: EarnedEmojiKind; title: string; hint: string; earnedShown: number; lockedShown: number };

export const shelfKinds: ShelfKind[] = [
  { kind: "team", title: "Team stickers", hint: "Collect everyone on a team, then unlock its sticker.", earnedShown: 6, lockedShown: 3 },
  { kind: "hype", title: "Hype", hint: "Give someone their first thoughtful kudos to unlock their hype emoji.", earnedShown: 6, lockedShown: 0 },
  { kind: "milestone", title: "Milestones", hint: "Reach gold in a milestone.", earnedShown: 6, lockedShown: 3 },
  { kind: "level", title: "Levels", hint: "One every five levels, up to level 25.", earnedShown: 6, lockedShown: 2 },
];

export type Shelf = { kind: ShelfKind; earned: AlbumEmoji[]; locked: AlbumEmoji[] };

export function byKind(first: Pick<AlbumEmoji, "kind">, second: Pick<AlbumEmoji, "kind">) {
  return kindOrder(first) - kindOrder(second);
}

function kindOrder({ kind }: Pick<AlbumEmoji, "kind">) {
  return shelfKinds.findIndex((shelf) => shelf.kind === kind);
}

export function shelvesOf(emojis: AlbumEmoji[]): Shelf[] {
  return shelfKinds.map((kind) => {
    const ofKind = emojis.filter((emoji) => emoji.kind === kind.kind);
    return { kind, earned: ofKind.filter(({ earned }) => earned).toSorted(newestFirst), locked: ofKind.filter(({ earned }) => !earned).toSorted(nearestFirst) };
  });
}

function newestFirst(first: AlbumEmoji, second: AlbumEmoji) {
  return (second.earnedAt ?? 0) - (first.earnedAt ?? 0) || levelOf(second) - levelOf(first) || first.name.localeCompare(second.name);
}

function nearestFirst(first: AlbumEmoji, second: AlbumEmoji) {
  return shareOf(second) - shareOf(first) || levelOf(first) - levelOf(second) || first.name.localeCompare(second.name);
}

export function shareOf({ progress }: AlbumEmoji) {
  return progress === null || progress.need <= 0 ? 0 : Math.min(1, progress.have / progress.need);
}

function levelOf({ kind, id }: AlbumEmoji) {
  return kind === "level" ? Number(causeOf(id)) : 0;
}

function causeOf(id: string) {
  return id.slice(id.indexOf(":") + 1);
}

export function earnedCountOf(emojis: AlbumEmoji[]) {
  return emojis.filter(({ earned }) => earned).length;
}

export function matchesSearch(emoji: AlbumEmoji, search: string) {
  const words = search.trim().toLowerCase().replace(/^:|:$/g, "");
  return [emoji.name, emoji.from, earnedFromWords(emoji)].some((text) => text.toLowerCase().includes(words));
}

export function isReadyToUnlock(emoji: AlbumEmoji) {
  return emoji.kind === "team" && !emoji.earned && emoji.progress !== null && emoji.progress.need > 0 && emoji.progress.have >= emoji.progress.need;
}

export function teamOf(emoji: Pick<AlbumEmoji, "kind" | "id">) {
  return emoji.kind === "team" ? causeOf(emoji.id) : null;
}

export function earnedFromWords(emoji: Pick<AlbumEmoji, "kind" | "id" | "from">) {
  switch (emoji.kind) {
    case "team":
      return `The ${emoji.from} team sticker`;
    case "milestone":
      return `Gold in ${milestoneOf(emoji)}: ${emoji.from}`;
    case "level":
      return `Reaching ${emoji.from.toLowerCase()}`;
    case "hype":
      return `Your first thoughtful pack for ${emoji.from}`;
  }
}

export function whyWords(emoji: AlbumEmoji) {
  const when = emoji.earnedAt === null ? "" : ` · ${dateOf(emoji.earnedAt)}`;
  switch (emoji.kind) {
    case "team":
      return `You unlocked the ${emoji.from} team sticker${when}`;
    case "milestone":
      return `You reached gold in ${milestoneOf(emoji)}${when}`;
    case "level":
      return `You reached ${emoji.from.toLowerCase()}`;
    case "hype":
      return `From your first thoughtful pack for ${emoji.from}${when}`;
  }
}

export function howToUnlockWords(emoji: AlbumEmoji) {
  const have = emoji.progress?.have ?? 0;
  const need = emoji.progress?.need ?? 0;
  switch (emoji.kind) {
    case "team":
      return isReadyToUnlock(emoji) ? `Everyone on ${emoji.from} is in: unlock the sticker on its page` : `Collect all ${need} people on ${emoji.from} · ${have} of ${need}`;
    case "milestone":
      return `Reach gold in ${milestoneOf(emoji)} · ${have} of ${need}`;
    case "level":
      return `Reach ${emoji.from.toLowerCase()} · ${number(have)} of ${number(need)} XP`;
    case "hype":
      return `Give ${firstNameOf(emoji.from)} their first thoughtful kudos`;
  }
}

function milestoneOf({ id }: Pick<AlbumEmoji, "id">) {
  return milestoneNameOf(causeOf(id) as MilestoneId);
}

function number(value: number) {
  return value.toLocaleString("en");
}

export const useItInSlackWords = "Use it in Slack: react with it or put it in a kudos.";

export function momentsOwedOf(album: Album, shown: ReadonlySet<string>): AlbumEmoji[] {
  return album.emojis.filter((emoji) => emoji.earned && !emoji.seen && !shown.has(emoji.id) && !heldForItsPack(album, emoji));
}

function heldForItsPack(album: Album, emoji: AlbumEmoji) {
  return emoji.kind === "hype" && album.packs.some(({ person }) => `hype:${person}` === emoji.id);
}
