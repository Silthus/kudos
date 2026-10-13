// PROTOTYPE building blocks on top of @posthog/quill. Screens compose Quill components directly;
// this file only holds the few pieces Quill doesn't have.
import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@posthog/quill";
import type { Rarity as RarityKind, Tier } from "./data/types";

export { HedgehogGardener, HedgehogHandClasp, HedgehogLevelUp, HedgehogReading, HedgehogSitting, HedgehogStar, HedgehogSuccess, HedgehogExplorer, HedgehogCard, HedgehogPuzzle, HedgehogSleepy, HedgehogHeart } from "@posthog/brand/hoggies";

export function PageHeader({ title, description, actions, hog: Hog }: { title: string; description?: ReactNode; actions?: ReactNode; hog?: ComponentType<{ size?: number; className?: string }> }) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end">
      {Hog && <Hog size={64} className="hidden shrink-0 sm:block" />}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const rarityLabel: Record<RarityKind, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const rarityClass: Record<RarityKind, string> = {
  common: "bg-r-common",
  uncommon: "bg-r-uncommon",
  rare: "bg-r-rare",
  epic: "bg-r-epic",
  legendary: "bg-r-legendary",
};

// P35: a coloured square plus the word. The only place the WoW colours appear.
export function Rarity({ rarity, className = "" }: { rarity: RarityKind; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span className={`inline-block size-2.5 rounded-[2px] ring-1 ring-black/20 ${rarityClass[rarity]}`} />
      {rarityLabel[rarity]}
    </span>
  );
}

export const rarityLabels = rarityLabel;

// Achievement tiers are not rarities (P58): a quiet medal in neutral metal tones, never the WoW colours.
const tierFill: Record<Tier, [string, string]> = {
  bronze: ["#d9a272", "#9a5f30"],
  silver: ["#e3e4e0", "#8f918a"],
  gold: ["#f6c94a", "#b88710"],
  diamond: ["#c9eef6", "#4aa7c2"],
};

export function TierMedal({ tier, earned, size = 28 }: { tier: Tier; earned: boolean; size?: number }) {
  const [light, dark] = tierFill[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`${tier}${earned ? "" : " (not yet)"}`} className={`shrink-0 ${earned ? "" : "opacity-30 grayscale"}`}>
      <circle cx="12" cy="12" r="10" fill={light} stroke={dark} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke={dark} strokeWidth="1" opacity="0.55" />
    </svg>
  );
}

export const tierLabel: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}
