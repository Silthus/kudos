// Variant E moments: mocked facts for each deep-link landing, including what waits behind each unlock; the website never computes game rules.
import type { ComponentType } from "react";
import { IconBook, IconHome, IconList, IconListTree, IconPalette, IconRibbon } from "@posthog/icons";
import type { Rarity, Tier } from "../../data/types";
import type { Feature } from "./unlocks";

export type MomentKind = "level-up" | "unlock" | "achievement" | "discovery" | "hedgehog" | "kudos" | "app-home";

export const momentKinds: Array<{ id: MomentKind; label: string }> = [
  { id: "level-up", label: "Level up" },
  { id: "unlock", label: "Unlock" },
  { id: "achievement", label: "Achievement" },
  { id: "discovery", label: "Discovery" },
  { id: "hedgehog", label: "New hedgehog" },
  { id: "kudos", label: "Kudos received" },
  { id: "app-home", label: "App Home" },
];

export const asMomentKind = (param?: string): MomentKind => momentKinds.find((k) => k.id === param)?.id ?? "discovery";

export const levelUp = { from: 7, to: 8, pointsGained: 1, pointsToSpend: 2, xpToNext: 330, barBefore: 86, barAfter: 53 };

export type UnlockMoment = { headline: string; waiting: string[]; cta: string };

export const unlockMoments: Record<Feature, UnlockMoment> = {
  book: { headline: "The Book is open", waiting: ["4 stickers already in your album, one for each teammate who thanked you", "Your first achievement ladders, with their tiers"], cta: "Open the Book" },
  gear: { headline: "Your character is ready", waiting: ["2 quips and 1 title waiting to equip", "Kudos emoji slots for the extra emoji you find"], cta: "Equip your gear" },
  skills: { headline: "Skill tree unlocked", waiting: ["3 skill points to spend, banked from levels 2, 3 and 4", "Three trees of perks, and every perk is yours for good"], cta: "Spend skill points" },
  coins: { headline: "Coins unlocked", waiting: ["Your next thoughtful kudos can earn your first coins", "Hedgehogs and perk upgrades to spend them on"], cta: "See what coins buy" },
  collection: { headline: "The hedgehog collection is open", waiting: ["Your first hedgehog is waiting on the shelf", "11 more to find, earn or buy"], cta: "Meet your hedgehogs" },
};

export const asUnlockFeature = (segment?: string): Feature => (segment && segment in unlockMoments ? (segment as Feature) : "skills");

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

export type TourStop = { href: string; label: string; blurb: string; Icon: ComponentType<{ className?: string }>; feature?: Feature };

export const tour: TourStop[] = [
  { href: "#/profile", label: "Profile", blurb: "Your level, gear, streak and the profile card teammates see", Icon: IconHome },
  { href: "#/skills", label: "Skill tree", blurb: "Spend skill points on perks", Icon: IconListTree, feature: "skills" },
  { href: "#/collection", label: "Collection", blurb: "Every hedgehog, owned or not", Icon: IconPalette, feature: "collection" },
  { href: "#/stickers", label: "Book", blurb: "Team sticker albums and your achievements", Icon: IconBook, feature: "book" },
  { href: "#/achievements", label: "Achievements", blurb: "Twelve ladders, four tiers each", Icon: IconRibbon, feature: "book" },
  { href: "#/leaderboard", label: "Leaderboard", blurb: "Who gave the most kudos this week", Icon: IconList },
];
