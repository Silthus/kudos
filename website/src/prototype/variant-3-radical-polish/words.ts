// PROTOTYPE (#625): words and small formatters for the Radical polish variant. Never merge to main.
import type { Message, Segment } from "../../../../convex/activity/entries";
import type { Rarity } from "../../shell";
import type { PackKind, Quest, QuestSource } from "../world";

export const rarityName: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export const questTag: Record<QuestSource, string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export const packName: Record<PackKind, string> = { journey: "Journey pack", weekly: "Weekly pack", group: "Team pack", bought: "Store pack" };

const nextLevelOpens: Record<number, string> = {
  7: "a third weekly quest and better odds of a rare hoggie",
  8: "a fourth kudos emoji slot in the store",
  9: "epic hoggies in store packs",
  10: "the gold frame for your profile card",
};

export function opensAt(level: number) {
  return nextLevelOpens[level] ?? "a pack with a hoggie you don't have yet";
}

export function questHeading(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

export function questDetail(quest: Quest) {
  if (quest.source !== "journey") return quest.goal;
  if (quest.opens !== null) return `Finishing it opens ${quest.opens}.`;
  return quest.hint ?? "The next step of your Journey.";
}

export function rewardWords({ xp, coins }: Quest["reward"]) {
  return [xp > 0 ? `+${xp} XP` : null, coins > 0 ? `${coins} coins` : null].filter((part) => part !== null).join(" · ");
}

export function plainTextOf(message: Message) {
  if (message.kind === "unavailable") return "The words of this kudos are from before HedgeHug kept them.";
  return message.segments.map(segmentText).join("").replace(/\s+/g, " ").trim();
}

function segmentText(segment: Segment) {
  if (segment.kind === "text") return segment.text;
  if (segment.kind === "person") return `@${segment.name}`;
  if (segment.kind === "group") return `@${segment.handle}`;
  if (segment.kind === "channel") return "#channel";
  if (segment.kind === "broadcast") return `@${segment.range}`;
  if (segment.kind === "emoji") return segment.unicode ?? "";
  if (segment.kind === "link") return segment.label ?? segment.url;
  return " ";
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function dayOf(at: number) {
  return dayFormat.format(at);
}

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
