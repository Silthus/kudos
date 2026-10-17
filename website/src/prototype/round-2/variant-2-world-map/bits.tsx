// PROTOTYPE (#625): small shared World map pieces: coins, foil packs, rarity pills and labels. Never merge to main.
import { useId, type CSSProperties } from "react";
import type { Rarity } from "../../../shell";
import { rarityColour, type PackKind } from "../../world";

export const rarityLabel: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="wm-coin">
      <circle cx="8" cy="8" r="7.25" fill="#F7A501" stroke="#B87A00" strokeWidth="1" />
      <circle cx="8" cy="8" r="4.4" fill="none" stroke="#FFE3A3" strokeWidth="1.3" />
    </svg>
  );
}

export function Coins({ amount, size = 16 }: { amount: number; size?: number }) {
  return (
    <span className="wm-coins">
      <Coin size={size} />
      <span>{amount}</span>
      <span className="sr-only"> coins</span>
    </span>
  );
}

export const packLook: Record<PackKind, { name: string; top: string; bottom: string; rarity: Rarity }> = {
  journey: { name: "Journey pack", top: "#ffd25a", bottom: "#f54e00", rarity: "legendary" },
  weekly: { name: "Weekly pack", top: "#8fd3ff", bottom: "#1d4aff", rarity: "rare" },
  group: { name: "Team pack", top: "#a8e6a0", bottom: "#2f8a3a", rarity: "uncommon" },
  bought: { name: "Market pack", top: "#ffb38a", bottom: "#c2410c", rarity: "epic" },
};

export function PackArt({ kind, width = 60, className = "" }: { kind: PackKind; width?: number; className?: string }) {
  const id = useId();
  const look = packLook[kind];
  const teeth = Array.from({ length: 9 }, (_, index) => `${4 + index * 6.5},${index % 2 === 0 ? 4 : 0}`).join(" ");
  return (
    <svg viewBox="0 0 60 84" width={width} height={(width * 84) / 60} className={`wm-pack-art ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={look.top} />
          <stop offset="0.55" stopColor={look.bottom} />
          <stop offset="1" stopColor={look.top} />
        </linearGradient>
      </defs>
      <polygon points={`4,4 ${teeth} 56,4 56,80 4,80`} fill={`url(#${id}-foil)`} stroke="#3d2a12" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="4" y="10" width="52" height="4" fill="rgb(255 255 255 / 45%)" />
      <rect x="4" y="70" width="52" height="4" fill="rgb(0 0 0 / 15%)" />
      <circle cx="30" cy="40" r="15" fill="#fdfdf8" stroke="#3d2a12" strokeWidth="1.5" />
      <path d="M30 29l3.2 7 7.6.7-5.8 5 1.8 7.4L30 45.2l-6.8 3.9 1.8-7.4-5.8-5 7.6-.7z" fill={look.bottom} />
      <path d="M8 18 52 66" stroke="rgb(255 255 255 / 35%)" strokeWidth="5" />
    </svg>
  );
}

export function RarityPill({ rarity }: { rarity: Rarity }) {
  return (
    <span className="wm-rarity" style={{ "--wm-rarity": rarityColour[rarity] } as CSSProperties}>
      {rarityLabel[rarity]}
    </span>
  );
}

export function shortDate(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
