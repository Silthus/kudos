import type { Collection, CollectionHoggie } from "../collectionRead";

export type LatestFind = CollectionHoggie & { firstAt: number };

export function latestFindOf({ hoggies }: Collection): LatestFind | null {
  return hoggies.filter(isFound).reduce<LatestFind | null>((latest, hoggie) => (latest === null || hoggie.firstAt > latest.firstAt ? hoggie : latest), null);
}

function isFound(hoggie: CollectionHoggie): hoggie is LatestFind {
  return hoggie.firstAt !== null;
}

export function foundWordsOf({ owned, total }: Collection) {
  return `${owned} of ${total} hoggies found`;
}
