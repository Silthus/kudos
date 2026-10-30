import { emojiArtPictureOf, milestoneTierArtOf, slugOf } from "../../../convex/album/emojiCatalogue";
import { stepNameOf, type MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { ReachedTier } from "../../../convex/album/milestones";
import type { LadderCard } from "../shell";
import type { Album, AlbumEmoji, AlbumMilestone, MilestoneTierId } from "./answer";
import { plural } from "./facts";

type Tier = AlbumMilestone["tiers"][number];

type Counted = { one: string; many: string };

type MilestoneWords = { name: string; counted: Counted; emblem: LadderCard["ladder"]; hint: string };

const milestoneWords: Record<MilestoneId, MilestoneWords> = {
  people: { name: "Faces in the album", counted: { one: "person in your album", many: "people in your album" }, emblem: "connections", hint: "Give someone new a kudos in Slack, then identify the items it earns" },
  teams: { name: "Full pages", counted: { one: "full team unlocked", many: "full teams unlocked" }, emblem: "team-spirit", hint: "Collect everyone on a team to unlock it" },
  reach: { name: "Across the company", counted: { one: "team in your album", many: "teams in your album" }, emblem: "old-friends", hint: "Thank someone from a team not yet in your album, then identify the items it earns" },
  hoggies: { name: "Hoggie hunter", counted: { one: "different hoggie found", many: "different hoggies found" }, emblem: "recognition", hint: "Identify your items to find hoggies you don't have yet. Repeats don't count" },
  thoughtful: { name: "Kudos given", counted: { one: "kudos given", many: "kudos given" }, emblem: "generosity", hint: "Give anyone a kudos in Slack. Thanking the same person again counts too" },
};

const tierWords: Record<MilestoneTierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export const metalOrder: readonly MilestoneTierId[] = ["bronze", "silver", "gold", "diamond"];

export function milestoneNameOf(milestone: MilestoneId) {
  return milestoneWords[milestone].name;
}

export function hintOf(milestone: MilestoneId) {
  return milestoneWords[milestone].hint;
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

function unitOf(milestone: MilestoneId, count: number) {
  const { one, many } = milestoneWords[milestone].counted;
  return count === 1 ? one : many;
}

export function isEarned(tier: Tier) {
  return tier.earnedAt !== null;
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
  return `${stepNameOf(milestone, tier)} · ${tierWordOf(tier)}`;
}

export function medalSpokenOf({ milestone, tier }: ReachedTier) {
  return `the ${stepNameOf(milestone, tier)} ${tierWordOf(tier).toLowerCase()} medal`;
}

export function medalEmojiOf(album: Album, { milestone, tier }: ReachedTier): TierEmoji | null {
  const listed = album.milestones.find(({ id }) => id === milestone);
  const step = listed?.tiers.find((reached) => reached.tier === tier);
  return listed === undefined || step === undefined ? null : tierEmojiOf(album, listed, step);
}

const howToGet: Record<MilestoneId, (toGo: number) => string> = {
  people: (toGo) => `Give a kudos to ${plural(toGo, "person", "people")} you haven't thanked yet.`,
  teams: (toGo) => `Collect everyone on ${plural(toGo, "more team", "more teams")}.`,
  reach: (toGo) => `Give a kudos to someone on a team not in your album yet (${toGo} to go).`,
  hoggies: (toGo) => `Find ${plural(toGo, "hoggie", "hoggies")} you don't have yet: hugs and kudos both find them.`,
  thoughtful: (toGo) => `Give ${toGo} more kudos. Thanking the same person again counts.`,
};

export function howToGetWords(milestone: MilestoneId, toGo: number) {
  return howToGet[milestone](toGo);
}

const hoggiePaid: Record<"capped" | "today", Record<MilestoneTierId, string>> = {
  capped: { bronze: "An uncommon or rare hoggie", silver: "A rare hoggie", gold: "A rare hoggie", diamond: "A rare hoggie" },
  today: { bronze: "An uncommon hoggie or rarer", silver: "A rare hoggie or rarer", gold: "An epic hoggie or rarer", diamond: "A legendary hoggie" },
};

export const kudosOnlyOddsWords = "Kudos are the only way to epic and legendary hoggies.";

export function hoggiePaidWords(tier: MilestoneTierId, rarityCaps: boolean) {
  return hoggiePaid[rarityCaps ? "capped" : "today"][tier];
}

export function slackActionWords(milestone: MilestoneId) {
  return milestone === "hoggies" ? "Hug a message in Slack" : "Give a kudos in Slack";
}
