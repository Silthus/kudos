// Variant E moments: mocked facts for each deep-link landing; the website never computes game rules.
import type { ComponentType } from "react";
import { IconBook, IconHome, IconList, IconListTree, IconPalette, IconRibbon } from "@posthog/icons";
import type { Rarity, Tier } from "../../data/types";

export type MomentKind = "level-up" | "achievement" | "discovery" | "hedgehog" | "kudos" | "app-home";

export const momentKinds: Array<{ id: MomentKind; label: string }> = [
  { id: "level-up", label: "Level up" },
  { id: "achievement", label: "Achievement" },
  { id: "discovery", label: "Discovery" },
  { id: "hedgehog", label: "New hedgehog" },
  { id: "kudos", label: "Kudos received" },
  { id: "app-home", label: "App Home" },
];

export const asMomentKind = (param?: string): MomentKind => momentKinds.find((k) => k.id === param)?.id ?? "discovery";

export const levelUp = { from: 7, to: 8, pointsGained: 1, pointsToSpend: 2, xpToNext: 330, barBefore: 86, barAfter: 53 };

export const achievement = {
  name: "Social Butterfly",
  ladder: "Connections",
  tier: "gold" as Tier,
  counts: "12 different people thanked",
  reward: { kind: "Emoji", name: "Butterfly", preview: "🦋", rarity: "rare" as Rarity },
};

export const discovery = { kind: "Quip", text: "Ship it, superstar.", rarity: "rare" as Rarity, foundWhile: "Found while you thanked Grace" };

export const newHogId = "hog-explorer";

export const kudos = {
  giver: "Ada Lindqvist",
  first: "Ada",
  initials: "AL",
  hue: 18,
  text: "thanks for pairing on the flaky test all afternoon, you found the race in ten minutes",
  xp: 5,
  coins: 2,
  drop: { kind: "Quip", name: "Hedgehog-approved work.", preview: "💬", rarity: "uncommon" as Rarity },
};

export type TourStop = { href: string; label: string; blurb: string; Icon: ComponentType<{ className?: string }> };

export const tour: TourStop[] = [
  { href: "#/profile", label: "Profile", blurb: "Your level, gear, streak and the profile card teammates see", Icon: IconHome },
  { href: "#/skills", label: "Skill tree", blurb: "Spend skill points on perks", Icon: IconListTree },
  { href: "#/collection", label: "Collection", blurb: "Hedgehogs, titles, quips and emoji", Icon: IconPalette },
  { href: "#/stickers", label: "Book", blurb: "Team sticker albums and your achievements", Icon: IconBook },
  { href: "#/achievements", label: "Achievements", blurb: "Twelve ladders, four tiers each", Icon: IconRibbon },
  { href: "#/leaderboard", label: "Leaderboard", blurb: "Who gave the most kudos this week", Icon: IconList },
];
