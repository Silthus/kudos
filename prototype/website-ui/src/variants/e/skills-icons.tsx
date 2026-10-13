// Variant E skill-tree icons: one PostHog icon per perk.
import type { ComponentType } from "react";
import {
  IconBatteryCharge,
  IconBolt,
  IconCalendar,
  IconCompass,
  IconDatabaseBolt,
  IconDay,
  IconHandMoney,
  IconHandwave,
  IconHeart,
  IconHeartFilled,
  IconPiggyBank,
  IconRocket,
  IconSparkles,
  IconSpotlight,
} from "@posthog/icons";

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
  echo: IconHeart,
  resonance: IconHeartFilled,
  reserve: IconBatteryCharge,
  reservoir: IconDatabaseBolt,
  treasurer: IconHandMoney,
  banker: IconPiggyBank,
};

export function PerkIcon({ perk, className = "size-5" }: { perk: string; className?: string }) {
  const Icon = perkIcons[perk] ?? IconSparkles;
  return <Icon className={`shrink-0 ${className}`} aria-hidden />;
}
