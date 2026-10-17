import type { Denial } from "../../convex/website/memberQuery";
import type { AlbumPerson, CollectionAnswer, CollectionCrest, CollectionHoggie, GroupAlbum, Sticker, TeamPage, TeamPerson } from "../../convex/website/collection";

export type { AlbumPerson, CollectionAnswer, CollectionCrest, CollectionHoggie, GroupAlbum, Sticker };

export type { TeamPage as CollectionTeamPage, TeamPerson as CollectionTeamPerson };

export type { RarityShare } from "../../convex/hoggies/collection";

export type Collection = Extract<CollectionAnswer, { kind: "collection" }>;

export type MyCollection = CollectionAnswer | Denial;

export type CollectionShown = MyCollection | { kind: "connecting" } | { kind: "broken" };

export type CollectionRead = (asking: boolean) => CollectionShown | undefined;
