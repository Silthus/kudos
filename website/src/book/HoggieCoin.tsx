import type { CSSProperties } from "react";
import type { Drop, Rarity } from "../crates/drops";
import { DropArtwork } from "../crates/Hoggie";
import "./collection.css";

type HoggieCoinProps = { art: Drop["art"]; rarity: Rarity; size: number; found?: boolean };

export function HoggieCoin({ art, rarity, size, found = true }: HoggieCoinProps) {
  return (
    <span aria-hidden="true" data-coin={found ? "found" : "missing"} className={`hoggie-coin ${found ? "" : "hog-silhouette"}`} style={{ width: size, height: size, "--rarity": `var(--rarity-${rarity})` } as CSSProperties}>
      <DropArtwork art={art} size={Math.round(size * 0.76)} />
    </span>
  );
}

export const nothingFoundYet: Drop["art"] = { kind: "hoggie", slug: "magnifying-glass" };
