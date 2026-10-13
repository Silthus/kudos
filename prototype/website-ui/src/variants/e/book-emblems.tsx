// Variant E book emblems: each ladder's hedgehog in a rosette whose metal follows its highest earned tier, a silhouette until the first tier, and each category's hedgehog.
import { useId, type ComponentType } from "react";
import {
  HedgehogCodingGroup,
  HedgehogExplorer,
  HedgehogHandClasp,
  HedgehogHeart,
  HedgehogHooligan,
  HedgehogHourglass,
  HedgehogKatyPerry,
  HedgehogMailbox,
  HedgehogMegaphone,
  HedgehogOrganized,
  HedgehogParty,
  HedgehogPuzzle,
  HedgehogReadingIsMagic,
  HedgehogRocket,
  HedgehogRollerCoaster,
  HedgehogScottPilgrim,
  HedgehogStar,
  HedgehogSuccess,
} from "@posthog/brand/hoggies";
import type { Ladder, Tier } from "../../data/types";
import { tierLabel } from "../../ui";
import { bestTier } from "./book-data";

export type Art = ComponentType<{ size?: number; className?: string; title?: string }>;

const ladderArt: Record<string, Art> = {
  generosity: HedgehogHeart,
  recognition: HedgehogStar,
  connections: HedgehogExplorer,
  momentum: HedgehogRollerCoaster,
  dependability: HedgehogOrganized,
  applause: HedgehogSuccess,
  seasons: HedgehogHourglass,
  "old-friends": HedgehogHandClasp,
  "team-spirit": HedgehogPuzzle,
  "crowd-favourite": HedgehogHooligan,
  "standing-ovation": HedgehogScottPilgrim,
  amplifier: HedgehogMegaphone,
};

const categoryArt: Record<string, Art> = {
  giving: HedgehogMailbox,
  thanked: HedgehogKatyPerry,
  connections: HedgehogCodingGroup,
  crowd: HedgehogParty,
  streaks: HedgehogRocket,
};

export const BookArt = HedgehogReadingIsMagic;

export const artOfLadder = (ladderId: string): Art => ladderArt[ladderId] ?? HedgehogStar;
export const artOfCategory = (categoryId: string): Art => categoryArt[categoryId] ?? HedgehogStar;

const metal: Record<Tier, { light: string; dark: string }> = {
  bronze: { light: "#d9a272", dark: "#9a5f30" },
  silver: { light: "#e3e4e0", dark: "#8f918a" },
  gold: { light: "#f6c94a", dark: "#b88710" },
  diamond: { light: "#c9eef6", dark: "#4aa7c2" },
};

const rosette = (() => {
  const points = 28;
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? 50 : 46;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
})();

export function LadderEmblem({ ladder, size = 64, className = "" }: { ladder: Ladder; size?: number; className?: string }) {
  const tier = bestTier(ladder);
  const Hog = artOfLadder(ladder.id);
  const label = tier ? `${ladder.name}, ${tierLabel[tier]}` : `${ladder.name}, not earned yet`;
  return (
    <span role="img" aria-label={label} title={label} className={`bk-emblem relative inline-grid shrink-0 place-items-center ${tier ? "" : "bk-emblem-locked"} ${className}`} style={{ width: size, height: size }}>
      <EmblemFrame tier={tier} />
      <span className="bk-emblem-face absolute grid place-items-center overflow-hidden rounded-full" style={{ inset: size * 0.15 }}>
        <Hog size={size * 0.8} className={`relative max-w-none translate-y-[8%] ${tier ? "" : "bk-silhouette"}`} title="" />
      </span>
      {size >= 40 && (tier === "gold" || tier === "diamond") && <Sparkle size={size * 0.24} />}
    </span>
  );
}

function EmblemFrame({ tier }: { tier?: Tier }) {
  const id = useId();
  const tone = tier ? metal[tier] : undefined;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
      {tone && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={tone.light} />
            <stop offset="0.55" stopColor={tone.light} />
            <stop offset="1" stopColor={tone.dark} />
          </linearGradient>
        </defs>
      )}
      <polygon points={rosette} fill={tone ? `url(#${id})` : "var(--muted)"} stroke={tone?.dark ?? "var(--border)"} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="38" fill="var(--card)" stroke={tone?.dark ?? "var(--border)"} strokeWidth={tone ? 2.5 : 1.5} strokeDasharray={tone ? undefined : "3 3"} />
      {tone && <circle cx="50" cy="50" r="42.5" fill="none" stroke={tone.dark} strokeWidth="0.8" opacity="0.5" />}
    </svg>
  );
}

function Sparkle({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="absolute -right-[4%] -top-[4%] drop-shadow-sm" aria-hidden>
      <path d="M12 1.5 14 10l8.5 2-8.5 2-2 8.5-2-8.5-8.5-2 8.5-2Z" fill="white" stroke="#8f918a" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
