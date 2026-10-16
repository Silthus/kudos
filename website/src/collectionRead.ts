import type { Denial } from "../../convex/website/memberQuery";
import type { CollectionAnswer, CollectionHoggie } from "../../convex/website/collection";

export type { CollectionAnswer, CollectionHoggie };

export type { RarityShare } from "../../convex/hoggies/collection";

export type Collection = Extract<CollectionAnswer, { kind: "collection" }>;

export type MyCollection = CollectionAnswer | Denial;

export type CollectionShown = MyCollection | { kind: "connecting" } | { kind: "broken" };

export type CollectionRead = (asking: boolean) => CollectionShown | undefined;
