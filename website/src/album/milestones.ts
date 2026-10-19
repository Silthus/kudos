import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { LadderCard } from "../shell";
import type { MilestoneTierId } from "./answer";

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

function unitOf(milestone: MilestoneId, count: number) {
  const { one, many } = milestoneWords[milestone].counted;
  return count === 1 ? one : many;
}
