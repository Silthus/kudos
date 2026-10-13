// Variant E book facts: the page index, album rosters, achievement categories and made-up earned dates, all mocked locally.
import { albums, ladders, members, stickers } from "../../data/mock";
import type { Album, Ladder, LadderTier, Member, Sticker } from "../../data/types";

export const albumsMineFirst: Album[] = [...albums].sort((a, b) => Number(b.mine) - Number(a.mine));

export type Category = { id: string; name: string; blurb: string; ladderIds: string[] };

export const categories: Category[] = [
  { id: "giving", name: "Giving", blurb: "Thanks you hand out, day after day and month after month.", ladderIds: ["generosity", "dependability", "seasons"] },
  { id: "thanked", name: "Being thanked", blurb: "Thanks that find their way back to you.", ladderIds: ["recognition", "standing-ovation"] },
  { id: "connections", name: "Connections", blurb: "The people you thank, old friends, and the albums you fill.", ladderIds: ["connections", "old-friends", "team-spirit"] },
  { id: "crowd", name: "Crowd", blurb: "Chime-ins: the crowd joining your kudos, and you joining theirs.", ladderIds: ["applause", "crowd-favourite", "amplifier"] },
  { id: "streaks", name: "Streaks", blurb: "Workdays in a row with a kudos given.", ladderIds: ["momentum"] },
];

export const laddersIn = (category: Category): Ladder[] => category.ladderIds.map((id) => ladders.find((l) => l.id === id)).filter((l): l is Ladder => l !== undefined);

export const tierCount = (shown: Ladder[]) => {
  const tiers = shown.flatMap((l) => l.tiers);
  return { earned: tiers.filter((t) => t.earned).length, total: tiers.length };
};

export type BookPage = { kind: "overview" } | { kind: "album"; album: Album } | { kind: "category"; category: Category };

export function pageFor(screen: string, param?: string): BookPage {
  if (screen === "stickers") {
    const album = albumsMineFirst.find((a) => a.group.id === param) ?? albumsMineFirst[0];
    return { kind: "album", album };
  }
  const category = categories.find((c) => c.id === param);
  return category ? { kind: "category", category } : { kind: "overview" };
}

export const pageHref = (page: BookPage) => (page.kind === "album" ? `#/stickers/${page.album.group.id}` : page.kind === "category" ? `#/achievements/${page.category.id}` : "#/achievements");

export const pageKey = (page: BookPage) => (page.kind === "album" ? `album:${page.album.group.id}` : page.kind === "category" ? `category:${page.category.id}` : "overview");

export type Slot = { number: number; member: Member; held: boolean; sticker?: Sticker };

const seeded = (seed: string) => {
  let hash = 2166136261;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
};

const shuffled = <T>(items: T[], seed: string) => {
  const random = seeded(seed);
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
};

export function rosterOf(album: Album): Slot[] {
  const missingIds = new Set(album.missing.map((m) => m.id));
  const held = shuffled(
    members.filter((m) => !missingIds.has(m.id)),
    album.group.id,
  ).slice(0, album.held);
  const everyone = shuffled([...held.map((member) => ({ member, held: true })), ...album.missing.map((member) => ({ member, held: false }))], `${album.group.id}-order`);
  const firstNumber = 1 + albumsMineFirst.slice(0, albumsMineFirst.indexOf(album)).reduce((sum, a) => sum + a.pages, 0);
  return everyone.map((slot, i) => ({ ...slot, number: firstNumber + i, sticker: stickers.find((s) => s.member.id === slot.member.id) }));
}

export const stickerTilt = (memberId: string, groupId: string) => (seeded(`${groupId}:${memberId}`)() - 0.5) * 3;

const earnedOn: Record<string, string[]> = {
  generosity: ["2026-01-12", "2026-03-02", "2026-07-21"],
  recognition: ["2026-01-14", "2026-04-09"],
  connections: ["2026-01-20", "2026-02-17", "2026-09-30"],
  momentum: ["2026-05-08"],
  dependability: ["2026-02-03", "2026-04-28"],
  applause: ["2026-06-11"],
  seasons: ["2026-01-12", "2026-03-02", "2026-06-01"],
  "old-friends": ["2026-08-19"],
  "team-spirit": ["2026-10-07"],
  "crowd-favourite": ["2026-05-26", "2026-09-15"],
  "standing-ovation": ["2026-07-03"],
  amplifier: ["2026-02-24", "2026-08-04"],
};

export const earnedDate = (ladder: Ladder, tierIndex: number) => (ladder.tiers[tierIndex]?.earned ? earnedOn[ladder.id]?.[tierIndex] : undefined);

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T12:00:00`));

export type Earned = { ladder: Ladder; tier: LadderTier; date: string };

export const recentlyEarned: Earned[] = ladders
  .flatMap((ladder) => ladder.tiers.map((tier, i) => ({ ladder, tier, date: earnedDate(ladder, i) })))
  .filter((e): e is Earned => e.date !== undefined)
  .sort((a, b) => b.date.localeCompare(a.date));

export type Reward = { kind: string; name: string };

export function rewardOf(reward: string): Reward {
  const [kind, ...rest] = reward.split(": ");
  const name = rest.join(": ");
  if (!name) return { kind: "Reward", name: reward };
  return { kind: kind === "Card" ? "Title" : kind, name };
}
