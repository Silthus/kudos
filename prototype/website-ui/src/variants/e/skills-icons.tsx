// Variant E branch icons: one PostHog icon per skill-tree branch, in place of B's emoji.
import type { ComponentType } from "react";
import { IconBatteryCharge, IconBolt, IconCalendar, IconCompass, IconDay, IconPalette, IconPeople, IconPresent, IconTelescope, IconSparkles } from "@posthog/icons";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  daily: IconDay,
  weekly: IconCalendar,
  active: IconBolt,
  breadth: IconCompass,
  receiving: IconPresent,
  capacity: IconBatteryCharge,
  discovery: IconTelescope,
  expression: IconPalette,
  group: IconPeople,
};

export function BranchIcon({ branch, className = "size-4" }: { branch: string; className?: string }) {
  const Icon = icons[branch] ?? IconSparkles;
  return <Icon className={`shrink-0 ${className}`} aria-hidden />;
}
