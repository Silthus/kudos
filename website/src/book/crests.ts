import type { CollectionCrest } from "../collectionRead";

export function collectedCrestsOf(crests: CollectionCrest[]) {
  return { collected: crests.filter(({ collectedAt }) => collectedAt !== null).length, total: crests.length };
}

export function crestWordsOf(crests: CollectionCrest[]) {
  const { collected, total } = collectedCrestsOf(crests);
  return `${collected} of ${total} team crests collected`;
}

export function crestCountOf(crests: CollectionCrest[]) {
  const { collected, total } = collectedCrestsOf(crests);
  return `${collected} of ${total} crests`;
}
