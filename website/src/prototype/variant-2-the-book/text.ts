// PROTOTYPE (#625): plain-text readings of kudos messages and quest labels for the book's printed pages. Never merge to main.
import type { KudosGiven, KudosReceived, Rarity } from "../../shell";
import type { Pack, Quest } from "../world";

type Message = KudosReceived["message"];

type Segment = Extract<Message, { kind: "text" }>["segments"][number];

function wordsOf(segment: Segment): string {
  if (segment.kind === "text") return segment.text;
  if (segment.kind === "person") return segment.name;
  if (segment.kind === "group") return segment.handle;
  if (segment.kind === "channel") return "#channel";
  if (segment.kind === "broadcast") return `@${segment.range}`;
  if (segment.kind === "emoji") return segment.unicode ?? `:${segment.name}:`;
  if (segment.kind === "link") return segment.label ?? segment.url;
  return " ";
}

export function plainTextOf(message: Message) {
  if (message.kind === "unavailable") return "This message is no longer available.";
  return message.segments.map(wordsOf).join("").replace(/\s+/g, " ").trim();
}

export function namesOf(entry: KudosGiven) {
  return entry.recipients.map(({ name }) => name).join(", ");
}

export function dayOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const sourceLabel: Record<Quest["source"], string> = { journey: "Journey · next step", weekly: "This week", group: "Team quest" };

export const packLabel: Record<Pack["kind"], string> = { journey: "Journey pack", weekly: "Weekly pack", group: "Team pack", bought: "Store pack" };

export function rewardOf({ reward }: Quest) {
  return [reward.xp > 0 ? `+${reward.xp} XP` : null, reward.coins > 0 ? `+${reward.coins} coins` : null].filter(Boolean).join(" · ");
}

export const rarityName: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
