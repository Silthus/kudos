import type { Denial } from "../../convex/website/memberQuery";
import type { PageWaits } from "../../convex/website/unlockPath";
import type { Drop, Rarity } from "./crates/drops";

export type CollectionHoggie = { hoggie: string; name: string; rarity: Rarity; art: Drop["art"]; count: number; firstAt: number | null; seen: string | null };

export type RarityShare = { rarity: Rarity; chance: number; owned: number; total: number };

export type Collection = { kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number };

export type CollectionAnswer = { kind: "not-found" } | PageWaits | Collection;

export type MyCollection = CollectionAnswer | Denial;

export type CollectionShown = MyCollection | { kind: "connecting" } | { kind: "broken" };

export type CollectionRead = (asking: boolean) => CollectionShown | undefined;
