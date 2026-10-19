import { milestoneCatalogue, type MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { Album, AlbumEmoji, EarnedEmojiKind, MilestoneTierId } from "./answer";
import { metalOrder, milestoneNameOf, tierWordOf } from "./milestones";
import { dateOf, firstNameOf, howToUseIt } from "./teamPage";

export type ShelfKind = { kind: EarnedEmojiKind; title: string; hint: string; earnedShown: number; lockedShown: number; onlyEarned: boolean };

export const shelfKinds: ShelfKind[] = [
  { kind: "team", title: "Team stickers", hint: "Collect everyone on a team, then unlock its sticker.", earnedShown: 6, lockedShown: 3, onlyEarned: false },
  { kind: "hype", title: "Hype", hint: "Give someone their first thoughtful kudos to unlock their hype emoji.", earnedShown: 6, lockedShown: 0, onlyEarned: true },
  { kind: "milestone", title: "Milestones", hint: "Earn a milestone's medals: each one has its emoji.", earnedShown: 6, lockedShown: 3, onlyEarned: false },
  { kind: "level", title: "Levels", hint: "One every five levels, up to level 25.", earnedShown: 6, lockedShown: 2, onlyEarned: false },
  { kind: "random", title: "Random drops", hint: "Now and then a thoughtful pack drops one of the workspace's emojis.", earnedShown: 6, lockedShown: 0, onlyEarned: true },
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
    const ofKind = emojis.filter((emoji) => emoji.kind === kind.kind && (emoji.earned || canBeEarned(emoji)));
    return { kind, earned: ofKind.filter(({ earned }) => earned).toSorted(newestFirst), locked: ofKind.filter(({ earned }) => !earned).toSorted(nearestFirst) };
  });
}

function canBeEarned({ progress }: AlbumEmoji) {
  return progress === null || progress.need > 0;
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

export function earnedFromWords(emoji: Pick<AlbumEmoji, "kind" | "id" | "from">): string {
  switch (emoji.kind) {
    case "team":
      return `The ${emoji.from} team sticker`;
    case "milestone":
      return `${tierOf(emoji)} in ${milestoneOf(emoji)}: ${emoji.from}`;
    case "level":
      return `Reaching ${emoji.from.toLowerCase()}`;
    case "hype":
      return `Your first thoughtful pack for ${emoji.from}`;
    case "random":
      return `A random drop in your pack for ${emoji.from}`;
  }
}

export function whyWords(emoji: AlbumEmoji): string {
  const when = emoji.earnedAt === null ? "" : ` · ${dateOf(emoji.earnedAt)}`;
  switch (emoji.kind) {
    case "team":
      return `You unlocked the ${emoji.from} team sticker${when}`;
    case "milestone":
      return `You reached ${tierOf(emoji).toLowerCase()} in ${milestoneOf(emoji)}${when}`;
    case "level":
      return `You reached ${emoji.from.toLowerCase()}`;
    case "hype":
      return `From your first thoughtful pack for ${emoji.from}${when}`;
    case "random":
      return `A random drop in your thoughtful pack for ${emoji.from}${when}`;
  }
}

export function howToUnlockWords(emoji: AlbumEmoji): string {
  const have = emoji.progress?.have ?? 0;
  const need = emoji.progress?.need ?? 0;
  switch (emoji.kind) {
    case "team":
      return isReadyToUnlock(emoji) ? `Everyone on ${emoji.from} is in: unlock the sticker on its page` : `Collect all ${need} people on ${emoji.from} · ${have} of ${need}`;
    case "milestone":
      return `Reach ${tierOf(emoji).toLowerCase()} in ${milestoneOf(emoji)} · ${have} of ${need}`;
    case "level":
      return `Reach ${emoji.from.toLowerCase()} · ${number(have)} of ${number(need)} XP`;
    case "hype":
      return `Give ${firstNameOf(emoji.from)} their first thoughtful kudos`;
    case "random":
      return "Open a thoughtful pack: now and then one drops a workspace emoji";
  }
}

function milestoneOf({ id, from }: Pick<AlbumEmoji, "id" | "from">) {
  const [milestone = ""] = causeOf(id).split(":");
  return isMilestone(milestone) ? milestoneNameOf(milestone) : from;
}

function tierOf({ id }: Pick<AlbumEmoji, "id">) {
  const tier = causeOf(id).split(":")[1] ?? "gold";
  return isTier(tier) ? tierWordOf(tier) : tierWordOf("gold");
}

function isTier(tier: string): tier is MilestoneTierId {
  return (metalOrder as readonly string[]).includes(tier);
}

function isMilestone(id: string): id is MilestoneId {
  return milestoneCatalogue.milestones.some((milestone) => milestone.id === id);
}

function number(value: number) {
  return value.toLocaleString("en");
}

export const useItInSlackWords = `Use it in Slack: ${howToUseIt}.`;

export const addItToSlackWords = `Add it to Slack from your emojis, then ${howToUseIt}.`;

export const findItInSlackWords = `Find it in Slack from your emojis, then ${howToUseIt}.`;

export function momentsOwedOf(album: Album, shown: ReadonlySet<string>): AlbumEmoji[] {
  return album.emojis.filter((emoji) => emoji.earned && !emoji.seen && !shown.has(emoji.id) && !heldForItsPack(album, emoji));
}

function heldForItsPack(album: Album, emoji: AlbumEmoji) {
  if (emoji.kind !== "hype") return false;
  return album.morePacks || album.packs.some(({ person }) => `hype:${person}` === emoji.id);
}

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}
