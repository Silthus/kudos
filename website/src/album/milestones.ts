import { emojiArtPictureOf, milestoneTierArtOf, slugOf } from "../../../convex/album/emojiCatalogue";
import { milestoneCatalogue, type MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { ReachedTier } from "../../../convex/album/milestones";
import type { LadderCard } from "../shell";
import type { Album, AlbumEmoji, AlbumMilestone, MilestoneTierId } from "./answer";

type Tier = AlbumMilestone["tiers"][number];

export type MedalStep = "earned" | "next" | "later";

export type MedalGoal = { tier: Tier; toGo: number };

type Counted = { one: string; many: string };

type MilestoneWords = { name: string; counted: Counted; emblem: LadderCard["ladder"] };

const milestoneWords: Record<MilestoneId, MilestoneWords> = {
  people: { name: "Faces in the album", counted: { one: "person in your album", many: "people in your album" }, emblem: "connections" },
  teams: { name: "Full pages", counted: { one: "team sticker unlocked", many: "team stickers unlocked" }, emblem: "team-spirit" },
  reach: { name: "Across the company", counted: { one: "team with someone in your album", many: "teams with someone in your album" }, emblem: "old-friends" },
  hoggies: { name: "Hoggie hunter", counted: { one: "hoggie found", many: "hoggies found" }, emblem: "recognition" },
  thoughtful: { name: "Kind words", counted: { one: "thoughtful kudos given", many: "thoughtful kudos given" }, emblem: "generosity" },
};

const tierWords: Record<MilestoneTierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export const metalOrder: readonly MilestoneTierId[] = ["bronze", "silver", "gold", "diamond"];

export function milestoneNameOf(milestone: MilestoneId) {
  return milestoneWords[milestone].name;
}

export function emblemOf(milestone: MilestoneId) {
  return milestoneWords[milestone].emblem;
}

export function tierWordOf(tier: MilestoneTierId) {
  return tierWords[tier];
}

export function countedWords(milestone: MilestoneId, count: number) {
  return `${count} ${unitOf(milestone, count)}`;
}

export function progressWords(milestone: MilestoneId, count: number, goal: number) {
  return `${Math.min(count, goal)} of ${goal} ${unitOf(milestone, goal)}`;
}

export function unitOf(milestone: MilestoneId, count: number) {
  const { one, many } = milestoneWords[milestone].counted;
  return count === 1 ? one : many;
}

export function isEarned(tier: Tier) {
  return tier.earnedAt !== null;
}

export function goalOf(milestone: AlbumMilestone, tier: Tier): MedalGoal {
  return { tier, toGo: Math.max(0, tier.at - milestone.count) };
}

export function nextGoalOf(milestone: AlbumMilestone): MedalGoal | null {
  const tier = milestone.tiers.find((listed) => !isEarned(listed));
  return tier === undefined ? null : goalOf(milestone, tier);
}

export function stepOf(milestone: AlbumMilestone, tier: Tier): MedalStep {
  if (isEarned(tier)) return "earned";
  return nextGoalOf(milestone)?.tier === tier ? "next" : "later";
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

export type TierEmoji = { name: string; picture: string; answered: AlbumEmoji | null };

export function tierEmojiOf(album: Album, milestone: AlbumMilestone, tier: Tier): TierEmoji {
  const answered = album.emojis.find(({ id }) => id === `milestone:${milestone.id}:${tier.tier}`) ?? null;
  return { name: answered?.name ?? slugOf(tier.name), picture: answered?.picture ?? emojiArtPictureOf("milestone", milestoneTierArtOf(milestone.id, tier.tier)), answered };
}

export function medalKeyOf({ milestone, tier }: ReachedTier) {
  return `${milestone}:${tier}`;
}

export function medalWordsOf({ milestone, tier }: ReachedTier) {
  const step = milestoneCatalogue.milestones.find(({ id }) => id === milestone)?.steps.find((listed) => listed.tier === tier);
  return `${step?.name ?? milestoneNameOf(milestone)} · ${tierWordOf(tier)}`;
}

export function medalEmojiOf(album: Album, { milestone, tier }: ReachedTier): TierEmoji | null {
  const listed = album.milestones.find(({ id }) => id === milestone);
  const step = listed?.tiers.find((reached) => reached.tier === tier);
  return listed === undefined || step === undefined ? null : tierEmojiOf(album, listed, step);
}
