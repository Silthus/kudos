// Variant E skill-tree icons: one PostHog icon per perk and per perk tree.
import type { ComponentType } from "react";
import {
  IconBatteryCharge,
  IconBolt,
  IconCalendar,
  IconClock,
  IconCompass,
  IconDatabaseBolt,
  IconDay,
  IconFlag,
  IconHandMoney,
  IconHandwave,
  IconHeart,
  IconHeartFilled,
  IconImage,
  IconLightBulb,
  IconMagic,
  IconMegaphone,
  IconPalette,
  IconPeople,
  IconPresent,
  IconRocket,
  IconSparkles,
  IconSpotlight,
  IconTelescope,
  IconThumbsUp,
} from "@posthog/icons";
import type { TreeId } from "./skills-trees";

type Icon = ComponentType<{ className?: string }>;

const perkIcons: Record<string, Icon> = {
  spark: IconDay,
  flame: IconSparkles,
  rhythm: IconCalendar,
  cadence: IconRocket,
  focus: IconBolt,
  spotlight: IconSpotlight,
  circle: IconCompass,
  bridge: IconHandwave,
  curiosity: IconTelescope,
  fortune: IconMagic,
  fieldnotes: IconFlag,
  beacon: IconLightBulb,
  keepsake: IconClock,
  signature: IconPalette,
  gallery: IconImage,
  echo: IconHeart,
  resonance: IconHeartFilled,
  reserve: IconBatteryCharge,
  reservoir: IconDatabaseBolt,
  rally: IconMegaphone,
  provision: IconHandMoney,
};

const treeIcons: Record<TreeId, Icon> = { generosity: IconThumbsUp, fortune: IconPresent, fellowship: IconPeople };

export function PerkIcon({ perk, className = "size-5" }: { perk: string; className?: string }) {
  const Icon = perkIcons[perk] ?? IconSparkles;
  return <Icon className={`shrink-0 ${className}`} aria-hidden />;
}

export function TreeIcon({ tree, className = "size-4" }: { tree: TreeId; className?: string }) {
  const Icon = treeIcons[tree];
  return <Icon className={`shrink-0 ${className}`} aria-hidden />;
}
