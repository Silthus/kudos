import type { LadderId } from "../../../convex/achievements/ladders";
import { slugOf } from "../../../convex/album/emojiCatalogue";
import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { Album, AlbumMilestone, MilestoneTierId } from "./answer";

type Tier = AlbumMilestone["tiers"][number];

export type MedalStep = "earned" | "next" | "later";

export type NextMedal = { milestone: AlbumMilestone; tier: Tier; toGo: number; share: number };

type MilestoneWords = { name: string; ladder: LadderId; counts: (count: number) => string };

export const milestoneWords: Record<MilestoneId, MilestoneWords> = {
  people: { name: "Faces in the album", ladder: "connections", counts: (count) => `${count === 1 ? "person" : "people"} in your album` },
  teams: { name: "Full pages", ladder: "team-spirit", counts: (count) => `team ${count === 1 ? "sticker" : "stickers"} unlocked` },
  reach: { name: "Across the company", ladder: "old-friends", counts: (count) => `${count === 1 ? "team" : "teams"} you've collected someone from` },
  hoggies: { name: "Hoggie hunter", ladder: "recognition", counts: (count) => `${count === 1 ? "hoggie" : "hoggies"} found` },
  thoughtful: { name: "Kind words", ladder: "generosity", counts: () => "thoughtful kudos given" },
};

export const metalWords: Record<MilestoneTierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export function isEarned(tier: Tier) {
  return tier.earnedAt !== null;
}

export function nextMedalOf(milestone: AlbumMilestone): NextMedal | null {
  const tier = milestone.tiers.find((listed) => !isEarned(listed));
  if (tier === undefined) return null;
  return { milestone, tier, toGo: Math.max(0, tier.at - milestone.count), share: Math.min(1, milestone.count / tier.at) };
}

export function stepOf(milestone: AlbumMilestone, tier: Tier): MedalStep {
  if (isEarned(tier)) return "earned";
  return nextMedalOf(milestone)?.tier === tier ? "next" : "later";
}

export function bestMetalOf(milestone: AlbumMilestone): MilestoneTierId | null {
  return milestone.tiers.findLast(isEarned)?.tier ?? null;
}

export function climbedShareOf(milestone: AlbumMilestone) {
  const reached = milestone.tiers.findLastIndex(isEarned);
  if (reached < 0) return 0;
  const from = milestone.tiers[reached]!;
  const to = milestone.tiers[reached + 1];
  if (to === undefined) return 1;
  const between = Math.min(1, Math.max(0, (milestone.count - from.at) / (to.at - from.at)));
  return (reached + between) / (milestone.tiers.length - 1);
}

export function medalsInAll(milestones: AlbumMilestone[]) {
  return milestones.flatMap(({ tiers }) => tiers).length;
}

export function closestNextOf(milestones: AlbumMilestone[]): NextMedal | null {
  return (
    milestones
      .map(nextMedalOf)
      .filter((next) => next !== null)
      .toSorted((one, other) => other.share - one.share || one.toGo - other.toGo)[0] ?? null
  );
}

export function goldEmojiOf(album: Album, milestone: AlbumMilestone): { name: string; unlocked: boolean } {
  const gold = milestone.tiers.find(({ tier }) => tier === "gold");
  const earned = album.emojis.find(({ id }) => id === `milestone:${milestone.id}`);
  return { name: earned?.name ?? slugOf(gold?.name ?? milestone.id), unlocked: gold !== undefined && isEarned(gold) };
}
