// PROTOTYPE (#625): small shared pieces of the Meadow realm: coins, meters, pack and bag glyphs, rarity words. Never merge to main.
import type { CSSProperties } from "react";
import { HedgehogParty } from "../../../hoggies";
import type { Rarity } from "../../../shell";
import type { Pack } from "../../world";
import type { BagIcon } from "./bags";

export const rarityName: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export const packName: Record<Pack["kind"], string> = { journey: "Journey pack", weekly: "Weekly pack", group: "Team pack", bought: "Hoggie pack" };

const packColour: Record<Pack["kind"], [string, string]> = {
  journey: ["#ffcf5a", "#f54e00"],
  weekly: ["#8fd3ff", "#1d4aff"],
  group: ["#9be7a8", "#2f8f46"],
  bought: ["#e2b6ff", "#7a3cd6"],
};

export function Coin({ size = 14 }: { size?: number }) {
  return <span className="mr-coin" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Coins({ amount, size }: { amount: number; size?: number }) {
  return (
    <span className="mr-coins">
      <Coin size={size} />
      {amount}
      <span className="sr-only"> coins</span>
    </span>
  );
}

export function Meter({ value, max, label, tone = "fire" }: { value: number; max: number; label: string; tone?: "fire" | "gold" | "green" }) {
  const share = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <span className={`mr-meter mr-meter-${tone}`} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}

export function PackArt({ kind, height }: { kind: Pack["kind"]; height: number }) {
  const [light, deep] = packColour[kind];
  return (
    <span className="mr-pack" style={{ width: Math.round(height * 0.66), height, "--pack-light": light, "--pack-deep": deep } as CSSProperties} aria-hidden="true">
      <span className="mr-pack-crimp mr-pack-crimp-top" />
      <HedgehogParty size={Math.round(height * 0.5)} className="mr-pack-hog" />
      <span className="mr-pack-crimp mr-pack-crimp-bottom" />
    </span>
  );
}

export function RarityPill({ rarity }: { rarity: Rarity }) {
  return (
    <span className="mr-rarity-pill" style={{ background: `var(--rarity-${rarity})` }}>
      {rarityName[rarity]}
    </span>
  );
}

const bagColour: Record<BagIcon, [string, string]> = {
  backpack: ["#c98a4b", "#7a4a1e"],
  satchel: ["#6aa0d8", "#2a4f86"],
  pouch: ["#b07ad8", "#5a2f86"],
  chest: ["#d8b04b", "#7a5a12"],
  basket: ["#8cc96a", "#3f7a24"],
};

export function BagGlyph({ icon, size = 34 }: { icon: BagIcon; size?: number }) {
  const [light, deep] = bagColour[icon];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="mr-bag-glyph">
      {icon === "backpack" && (
        <>
          <path d="M14 9a6 6 0 0 1 12 0v2h-3V9a3 3 0 0 0-6 0v2h-3z" fill={deep} />
          <rect x="7" y="11" width="26" height="25" rx="7" fill={light} stroke={deep} strokeWidth="2" />
          <rect x="12" y="22" width="16" height="10" rx="3" fill={deep} opacity="0.45" />
          <circle cx="20" cy="17" r="2" fill="#ffe08a" stroke={deep} />
        </>
      )}
      {icon === "satchel" && (
        <>
          <path d="M9 14c0-6 22-6 22 0" fill="none" stroke={deep} strokeWidth="3" />
          <rect x="5" y="14" width="30" height="21" rx="5" fill={light} stroke={deep} strokeWidth="2" />
          <path d="M5 18h30l-4 8H9z" fill={deep} opacity="0.5" />
          <rect x="17" y="22" width="6" height="6" rx="1.5" fill="#ffe08a" stroke={deep} />
        </>
      )}
      {icon === "pouch" && (
        <>
          <path d="M13 12c-6 5-8 10-8 15 0 6 6 9 15 9s15-3 15-9c0-5-2-10-8-15z" fill={light} stroke={deep} strokeWidth="2" />
          <path d="M12 12h16l-3-6H15z" fill={light} stroke={deep} strokeWidth="2" />
          <path d="M11 13c4 2 14 2 18 0" fill="none" stroke="#ffe08a" strokeWidth="2.5" />
          <path d="M20 21l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="#ffe08a" />
        </>
      )}
      {icon === "chest" && (
        <>
          <path d="M5 18c0-7 5-10 15-10s15 3 15 10z" fill={light} stroke={deep} strokeWidth="2" />
          <rect x="5" y="18" width="30" height="17" rx="2" fill={light} stroke={deep} strokeWidth="2" />
          <path d="M5 18h30M12 8.5v26.5M28 8.5v26.5" stroke={deep} strokeWidth="2" />
          <rect x="17" y="16" width="6" height="7" rx="1.5" fill="#ffe08a" stroke={deep} />
        </>
      )}
      {icon === "basket" && (
        <>
          <path d="M10 17c0-10 20-10 20 0" fill="none" stroke={deep} strokeWidth="3" />
          <path d="M5 17h30l-4 18H9z" fill={light} stroke={deep} strokeWidth="2" />
          <path d="M8 23h24M9 29h22M15 17l1 18M25 17l-1 18M20 17v18" stroke={deep} strokeWidth="1.5" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

export function dateOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
