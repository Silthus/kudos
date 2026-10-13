// Variant E moments: mocked facts for each deep-link landing, including what waits behind each unlock, inside a quest's reward crate, and the skill points left at a level; the website never computes game rules.
import type { ComponentType } from "react";
import { IconBook, IconCheckbox, IconHome, IconListTree, IconPalette, IconRibbon, IconStar } from "@posthog/icons";
import type { Tier } from "../../data/types";
import { ownedAt, pointsEarnedAt, pointsSpentOn } from "./skills-perks";
import type { Rewards } from "./unlock-reward";
import type { Feature } from "./unlocks";

export type MomentKind = "level-up" | "unlock" | "quest" | "achievement" | "hedgehog" | "kudos" | "app-home";

export const momentKinds: Array<{ id: MomentKind; label: string }> = [
  { id: "level-up", label: "Level up" },
  { id: "unlock", label: "Unlock" },
  { id: "quest", label: "Quest reward" },
  { id: "achievement", label: "Achievement" },
  { id: "hedgehog", label: "New hedgehog" },
  { id: "kudos", label: "Kudos received" },
  { id: "app-home", label: "App Home" },
];

export const asMomentKind = (param?: string): MomentKind => momentKinds.find((k) => k.id === param)?.id ?? "level-up";

export const levelUp = { xpToNext: 330, barBefore: 86, barAfter: 53 };

export const unspentPointsAt = (level: number) => pointsEarnedAt(level) - pointsSpentOn(ownedAt(level));

export type UnlockMoment = { headline: string; waiting: string[]; cta: string };

export const unlockMoments: Record<Feature, UnlockMoment> = {
  quests: { headline: "Quests are open", waiting: ["Three weekly quests, fresh every Monday", "A group quest your whole team fills together"], cta: "See this week's quests" },
  leaderboard: { headline: "The leaderboard is open", waiting: ["Where you stand in your group this week", "How your group ranks by kudos given per person"], cta: "See where you stand" },
  book: { headline: "The Book is open", waiting: ["4 stickers already in your album, one for each teammate who thanked you", "Your first achievement ladders, with their tiers"], cta: "Open the Book" },
  skills: { headline: "Skill tree unlocked", waiting: ["Your first skill point to spend, with one more every level", "Three trees of perks: more XP, more coins or more kudos"], cta: "Spend your skill point" },
  coins: { headline: "Coins unlocked", waiting: ["Your next thoughtful kudos earns your first coins", "Prices on hedgehogs and kudos emoji"], cta: "See what coins buy" },
  inventory: { headline: "Your inventory is open", waiting: ["An avatar slot for your hedgehog", "3 slots for kudos emoji, and the emoji you earned so far"], cta: "Open your inventory" },
  collection: { headline: "The hedgehog collection is open", waiting: ["Your first hedgehog is waiting on the shelf", "11 more to earn from levels, achievements and quests, or to buy"], cta: "Meet your hedgehogs" },
};

export const asUnlockFeature = (segment?: string): Feature => (segment && segment in unlockMoments ? (segment as Feature) : "skills");

export const questReward: { quest: string; progress: string; rewards: Rewards } = {
  quest: "Thank three people outside your group",
  progress: "3 of 3 thanked",
  rewards: { xp: 40, coins: 15, emoji: "🦔" },
};

export const achievement = {
  name: "Social Butterfly",
  ladder: "Connections",
  tier: "gold" as Tier,
  counts: "12 different people thanked",
  reward: { emoji: "🦋", name: "Butterfly", coins: 25 },
};

export const newHogId = "hog-explorer";

export const kudos = {
  giver: "Ada Lindqvist",
  first: "Ada",
  initials: "AL",
  hue: 18,
  text: "thanks for pairing on the flaky test all afternoon, you found the race in ten minutes",
  xp: 5,
  coins: 2,
};

export type TourStop = { href: string; label: string; blurb: string; Icon: ComponentType<{ className?: string }>; feature?: Feature };

export const tour: TourStop[] = [
  { href: "#/profile", label: "Profile", blurb: "Your hedgehog, level, kudos left today and the card teammates see", Icon: IconHome },
  { href: "#/quests", label: "Quests", blurb: "This week's quests, and one for your whole group", Icon: IconCheckbox, feature: "quests" },
  { href: "#/leaderboard", label: "Leaderboard", blurb: "Who gave the most kudos this week", Icon: IconStar, feature: "leaderboard" },
  { href: "#/stickers", label: "Book", blurb: "Team sticker albums and your achievements", Icon: IconBook, feature: "book" },
  { href: "#/achievements", label: "Achievements", blurb: "Twelve ladders, four tiers each", Icon: IconRibbon, feature: "book" },
  { href: "#/skills", label: "Skill tree", blurb: "Spend skill points on perks", Icon: IconListTree, feature: "skills" },
  { href: "#/collection", label: "Collection", blurb: "Every hedgehog, owned or not", Icon: IconPalette, feature: "collection" },
];
