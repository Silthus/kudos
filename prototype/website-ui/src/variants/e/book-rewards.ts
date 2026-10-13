// Variant E book rewards: a local table of what each achievement tier gives, coins at bronze, a kudos emoji at silver, a hedgehog at gold, and coins plus a hedgehog at diamond.
import type { ComponentType } from "react";
import {
  HedgehogAngel,
  HedgehogBoombox,
  HedgehogCampfireCowboy,
  HedgehogCoffeeCup,
  HedgehogDirector,
  HedgehogDj,
  HedgehogEinsteinGroup,
  HedgehogGardener,
  HedgehogGatsby,
  HedgehogHoney,
  HedgehogMountie,
  HedgehogPhoneCall,
  HedgehogPinata,
  HedgehogReporter,
  HedgehogRobot,
  HedgehogSafari,
  HedgehogSoapbox,
  HedgehogSpeaker,
  HedgehogSurfer,
  HedgehogTourist,
  HedgehogTownCrier,
  HedgehogTwoPlayer,
} from "@posthog/brand/hoggies";
import type { Ladder, LadderTier } from "../../data/types";

type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;

export type RewardHog = { name: string; Art: HogArt };

export type Reward = { coins?: number; emoji?: string; hedgehog?: RewardHog };

type LadderRewards = { emoji: string; gold: RewardHog; diamond: RewardHog };

const hog = (name: string, Art: HogArt): RewardHog => ({ name, Art });

const table: Record<string, LadderRewards> = {
  generosity: { emoji: "💝", gold: hog("Honey Hog", HedgehogHoney), diamond: hog("Angel Hog", HedgehogAngel) },
  recognition: { emoji: "👀", gold: hog("Director Hog", HedgehogDirector), diamond: hog("Gatsby Hog", HedgehogGatsby) },
  connections: { emoji: "🦋", gold: hog("Tourist Hog", HedgehogTourist), diamond: hog("Safari Hog", HedgehogSafari) },
  dependability: { emoji: "🌳", gold: hog("Gardener Hog", HedgehogGardener), diamond: hog("Mountie Hog", HedgehogMountie) },
  applause: { emoji: "📣", gold: hog("Boombox Hog", HedgehogBoombox), diamond: hog("DJ Hog", HedgehogDj) },
  seasons: { emoji: "🍂", gold: hog("Campfire Hog", HedgehogCampfireCowboy), diamond: hog("Surfer Hog", HedgehogSurfer) },
  "old-friends": { emoji: "📸", gold: hog("Coffee Hog", HedgehogCoffeeCup), diamond: hog("Phone-call Hog", HedgehogPhoneCall) },
  "team-spirit": { emoji: "🤝", gold: hog("Two-player Hog", HedgehogTwoPlayer), diamond: hog("Study Group Hog", HedgehogEinsteinGroup) },
  "crowd-favourite": { emoji: "📯", gold: hog("Piñata Hog", HedgehogPinata), diamond: hog("Town Crier Hog", HedgehogTownCrier) },
  "standing-ovation": { emoji: "👏", gold: hog("Speaker Hog", HedgehogSpeaker), diamond: hog("Soapbox Hog", HedgehogSoapbox) },
  amplifier: { emoji: "🔊", gold: hog("Reporter Hog", HedgehogReporter), diamond: hog("Robot Hog", HedgehogRobot) },
};

const fallback: LadderRewards = table.generosity;

export function rewardOf(ladder: Ladder, tier: LadderTier): Reward {
  const rewards = table[ladder.id] ?? fallback;
  switch (tier.tier) {
    case "bronze":
      return { coins: 10 };
    case "silver":
      return { emoji: rewards.emoji };
    case "gold":
      return { hedgehog: rewards.gold };
    case "diamond":
      return { coins: 100, hedgehog: rewards.diamond };
  }
}

export function rewardText({ coins, emoji, hedgehog }: Reward) {
  return [coins && `${coins} coins`, emoji && `${emoji} kudos emoji`, hedgehog?.name].filter(Boolean).join(" + ");
}
