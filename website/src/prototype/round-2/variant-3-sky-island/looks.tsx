// PROTOTYPE (#625): Sky island's small shared looks: coins, packs, meters, rarity and quest words. Never merge to main.
import type { CSSProperties } from "react";
import type { Message } from "../../../../../convex/activity/entries";
import type { Rarity } from "../../../shell";
import type { PackKind, Quest } from "../../world";

export const rarityLabel: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export const packLook: Record<PackKind, { name: string; colour: string; rarity: Rarity }> = {
  journey: { name: "Journey pack", colour: "#e0a100", rarity: "legendary" },
  weekly: { name: "Weekly pack", colour: "#1d4aff", rarity: "rare" },
  group: { name: "Team pack", colour: "#1f8a3b", rarity: "uncommon" },
  bought: { name: "Merchant pack", colour: "#f54e00", rarity: "epic" },
};

export const sourceTag: Record<Quest["source"], string> = { journey: "Journey", weekly: "Weekly", group: "Team" };

export function questName(quest: Quest) {
  return quest.source === "journey" ? quest.goal : quest.title;
}

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="sk-coin">
      <circle cx="8" cy="8" r="7.25" fill="#F7A501" stroke="#B87A00" strokeWidth="1" />
      <circle cx="8" cy="8" r="4.4" fill="none" stroke="#FFE3A3" strokeWidth="1.3" />
    </svg>
  );
}

export function Coins({ amount, size = 16 }: { amount: number; size?: number }) {
  return (
    <span className="sk-coins">
      <Coin size={size} />
      {amount}
      <span className="sr-only"> coins</span>
    </span>
  );
}

export function PackArt({ kind, size }: { kind: PackKind; size: number }) {
  return (
    <span className="sk-pack" style={{ "--pack": packLook[kind].colour, width: size * 0.7, height: size } as CSSProperties} aria-hidden="true">
      <span className="sk-pack-seal">H</span>
    </span>
  );
}

export function Meter({ value, max, label, colour }: { value: number; max: number; label: string; colour?: string }) {
  const share = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <span className="sk-meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} style={colour === undefined ? undefined : ({ "--meter": colour } as CSSProperties)}>
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}

export function textOf(message: Message) {
  if (message.kind === "unavailable") return "Message not available";
  return message.segments
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "person") return `@${segment.name}`;
      if (segment.kind === "emoji") return segment.unicode ?? `:${segment.name}:`;
      if (segment.kind === "link") return segment.label ?? segment.url;
      if (segment.kind === "group") return `@${segment.handle}`;
      return " ";
    })
    .join("")
    .trim();
}

export function dayOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
