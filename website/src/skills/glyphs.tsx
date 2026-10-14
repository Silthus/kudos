import type { ComponentType } from "react";
import { IconCalendar, IconCompass, IconDay } from "@posthog/icons";
import type { PerkNode } from "../shell";

export function SkillPointGlyph({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 text-completed-foreground ${className}`} aria-hidden="true">
      <path d="M8 1 15 8 8 15 1 8Z" fill="currentColor" />
      <path d="M8 4.5 11.5 8 8 11.5 4.5 8Z" fill="var(--card)" opacity=".55" />
    </svg>
  );
}

const perkIcons: Record<PerkNode["perk"], ComponentType<{ className?: string }>> = {
  spark: IconDay,
  rhythm: IconCalendar,
  circle: IconCompass,
};

export function PerkIcon({ perk, className = "size-5" }: { perk: PerkNode["perk"]; className?: string }) {
  const Icon = perkIcons[perk];
  return (
    <span aria-hidden="true" className="contents">
      <Icon className={`shrink-0 ${className}`} />
    </span>
  );
}
