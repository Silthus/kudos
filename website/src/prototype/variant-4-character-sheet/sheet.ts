// PROTOTYPE (#625): shared helpers for the character sheet: rarity labels, medal metals, ticking numbers. Never merge to main.
import { useEffect, useRef, useState } from "react";
import type { Message } from "../../../../convex/activity/entries";
import type { TierId } from "../../../../convex/achievements/ladders";
import { prefersReducedMotion } from "../../reducedMotion";
import type { LadderCard, Rarity } from "../../shell";
import type { PackKind } from "../world";

export const rarityLabel: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export const metalOf: Record<TierId, { colour: string; rarity: Rarity }> = {
  bronze: { colour: "#9a5a22", rarity: "uncommon" },
  silver: { colour: "#6b7480", rarity: "rare" },
  gold: { colour: "#a87a00", rarity: "epic" },
  diamond: { colour: "#167a9a", rarity: "legendary" },
};

const tierRank: Record<TierId, number> = { bronze: 0, silver: 1, gold: 2, diamond: 3 };

export function topTierOf(ladders: LadderCard[]) {
  const earned = ladders.flatMap((ladder) => ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).map((tier) => ({ ladder, tier })));
  return earned.toSorted((first, second) => tierRank[second.tier.tier] - tierRank[first.tier.tier])[0] ?? null;
}

export const packLook: Record<PackKind, { name: string; colour: string; rarity: Rarity; flavour: string }> = {
  journey: { name: "Journey Pack", colour: "#c98a00", rarity: "legendary", flavour: "Sealed with wax from the main quest line." },
  weekly: { name: "Weekly Pack", colour: "#1d4aff", rarity: "rare", flavour: "Smells faintly of Monday." },
  group: { name: "Team Pack", colour: "#1f8a3b", rarity: "uncommon", flavour: "Earned together, opened alone." },
  bought: { name: "Store Pack", colour: "#f54e00", rarity: "epic", flavour: "Fresh from the vendor's cart." },
};

export function textOf(message: Message) {
  if (message.kind === "unavailable") return "(message unavailable)";
  return message.segments
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "person") return segment.name;
      if (segment.kind === "emoji") return `:${segment.name}:`;
      if (segment.kind === "link") return segment.label ?? segment.url;
      if (segment.kind === "group") return segment.handle;
      if (segment.kind === "channel") return "#channel";
      if (segment.kind === "broadcast") return segment.range;
      return " ";
    })
    .join("")
    .trim();
}

export function useTicking(target: number, duration = 900) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const origin = current.current;
    if (origin === target || prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      current.current = Math.round(origin + (target - origin) * eased);
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

export function dayOf(at: number) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
