// PROTOTYPE (#625) round 2 variant 4: small shared pieces: coins, foil packs, rarity pills, meters and tab icons. Never merge to main.
import type { CSSProperties } from "react";
import { HedgehogCodingGroup, HedgehogExplorer, HedgehogHeart, HedgehogMoney, HedgehogParty, HedgehogReading, HedgehogStar, HedgehogWizard, type Hoggie } from "../../../hoggies";
import type { Rarity } from "../../../shell";
import { HoggieArt } from "../../art";
import type { Pack } from "../../world";
import type { TabIcon } from "./bag";

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="gh-coin-svg">
      <circle cx="8" cy="8" r="7.25" fill="#F7A501" stroke="#B87A00" strokeWidth="1" />
      <circle cx="8" cy="8" r="4.4" fill="none" stroke="#FFE3A3" strokeWidth="1.3" />
    </svg>
  );
}

export function Coins({ amount, size = 16 }: { amount: number; size?: number }) {
  return (
    <span className="gh-coins">
      <Coin size={size} />
      {amount}
      <span className="sr-only"> coins</span>
    </span>
  );
}

const packColour: Record<Pack["kind"], string> = { journey: "#F54E00", weekly: "#1D4AFF", group: "#2f9e44", bought: "#8a3ffc" };

const packFace: Record<Pack["kind"], string> = { journey: "rocket", weekly: "chef", group: "heart", bought: "wizard" };

export function PackArt({ kind, width, tearing = false }: { kind: Pack["kind"]; width: number; tearing?: boolean }) {
  return (
    <span className={`gh-pack ${tearing ? "gh-pack-tearing" : ""}`} style={{ width, height: width * 1.45, "--pack": packColour[kind] } as CSSProperties} aria-hidden="true">
      <span className="gh-pack-crimp gh-pack-crimp-top" />
      <span className="gh-pack-face">
        <HoggieArt slug={packFace[kind]} size={Math.round(width * 0.7)} />
      </span>
      <span className="gh-pack-crimp gh-pack-crimp-bottom" />
      <span className="gh-pack-shine" />
    </span>
  );
}

export function RarityPill({ rarity }: { rarity: Rarity }) {
  return (
    <span className="gh-rarity" style={{ background: `var(--rarity-${rarity})` }}>
      {rarity}
    </span>
  );
}

export function Meter({ value, max, label, colour }: { value: number; max: number; label: string; colour?: string }) {
  const share = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <span className="gh-meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} style={colour === undefined ? undefined : ({ "--meter": colour } as CSSProperties)}>
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}

const iconArt: Record<TabIcon, Hoggie> = {
  star: HedgehogStar,
  heart: HedgehogHeart,
  party: HedgehogParty,
  money: HedgehogMoney,
  wizard: HedgehogWizard,
  explorer: HedgehogExplorer,
  reading: HedgehogReading,
  group: HedgehogCodingGroup,
};

export function TabIconArt({ icon, size }: { icon: TabIcon; size: number }) {
  const Art = iconArt[icon];
  return <Art size={size} />;
}
