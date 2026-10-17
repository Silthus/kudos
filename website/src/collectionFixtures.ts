import { assets } from "@posthog/brand/hoggies/metadata";
import { catalogue, rarities, type CatalogueCrest, type Rarity } from "../../convex/hoggies/catalogue";
import type { Collection, CollectionCrest, CollectionHoggie, CollectionRead, MyCollection, RarityShare } from "./collectionRead";
import { showsTheBookSpread } from "./book/spread/bookSpread";
import type { Drop, ShellState } from "./shell";
import { albums, stickers } from "./stickerBookFixtures";
import { teamPages, teamStickers } from "./teamPagesFixtures";

const at = (iso: string) => Date.parse(iso);

const names = new Map(assets.map(({ slug, name }) => [slug, name]));

type Find = { count: number; firstAt: string };

const found: Record<string, Find> = {
  asleep: { count: 2, firstAt: "2026-09-02T09:00:00Z" },
  ball: { count: 1, firstAt: "2026-09-03T09:00:00Z" },
  banana: { count: 3, firstAt: "2026-09-04T09:00:00Z" },
  beaker: { count: 1, firstAt: "2026-09-07T09:00:00Z" },
  burger: { count: 1, firstAt: "2026-09-08T09:00:00Z" },
  card: { count: 1, firstAt: "2026-09-09T09:00:00Z" },
  cereal: { count: 2, firstAt: "2026-09-10T09:00:00Z" },
  chart: { count: 1, firstAt: "2026-09-11T09:00:00Z" },
  coconut: { count: 1, firstAt: "2026-09-14T09:00:00Z" },
  "code-bubble": { count: 1, firstAt: "2026-09-15T09:00:00Z" },
  "coffee-cup": { count: 4, firstAt: "2026-09-16T09:00:00Z" },
  commuter: { count: 1, firstAt: "2026-09-17T09:00:00Z" },
  croissant: { count: 1, firstAt: "2026-09-18T09:00:00Z" },
  error: { count: 1, firstAt: "2026-09-21T09:00:00Z" },
  heart: { count: 2, firstAt: "2026-09-22T09:00:00Z" },
  honey: { count: 1, firstAt: "2026-09-23T09:00:00Z" },
  hourglass: { count: 1, firstAt: "2026-09-24T09:00:00Z" },
  mailbox: { count: 1, firstAt: "2026-09-25T09:00:00Z" },
  megaphone: { count: 1, firstAt: "2026-09-28T09:00:00Z" },
  money: { count: 1, firstAt: "2026-09-29T09:00:00Z" },
  party: { count: 1, firstAt: "2026-09-30T09:00:00Z" },
  reading: { count: 1, firstAt: "2026-10-01T09:00:00Z" },
  star: { count: 2, firstAt: "2026-10-02T09:00:00Z" },
  success: { count: 1, firstAt: "2026-10-05T09:00:00Z" },
  chef: { count: 1, firstAt: "2026-09-05T09:00:00Z" },
  climber: { count: 1, firstAt: "2026-09-12T09:00:00Z" },
  doctor: { count: 1, firstAt: "2026-09-19T09:00:00Z" },
  "drake-yah": { count: 2, firstAt: "2026-09-26T09:00:00Z" },
  einstein: { count: 1, firstAt: "2026-10-03T09:00:00Z" },
  explorer: { count: 1, firstAt: "2026-10-06T09:00:00Z" },
  namaste: { count: 1, firstAt: "2026-10-07T09:00:00Z" },
  surfer: { count: 1, firstAt: "2026-10-08T09:00:00Z" },
  tourist: { count: 1, firstAt: "2026-10-09T09:00:00Z" },
  dj: { count: 1, firstAt: "2026-09-13T09:00:00Z" },
  puzzle: { count: 1, firstAt: "2026-09-27T09:00:00Z" },
  robot: { count: 2, firstAt: "2026-10-04T09:00:00Z" },
  rose: { count: 1, firstAt: "2026-10-10T09:00:00Z" },
  sailor: { count: 1, firstAt: "2026-10-12T09:00:00Z" },
  "katy-perry": { count: 1, firstAt: "2026-09-20T09:00:00Z" },
  "level-up": { count: 1, firstAt: "2026-10-13T09:00:00Z" },
  rocket: { count: 1, firstAt: "2026-10-14T15:00:00Z" },
};

function hoggieOf(hoggie: string, rarity: Rarity, find: Find | undefined): CollectionHoggie {
  const firstAt = find === undefined ? null : at(find.firstAt);
  return { hoggie, name: names.get(hoggie) ?? hoggie, rarity, art: { kind: "hoggie", slug: hoggie }, count: find?.count ?? 0, firstAt, seen: firstAt === null ? null : `hoggie:${hoggie}:${firstAt}` };
}

function crestOf({ crest, name, roster }: CatalogueCrest, hoggies: CollectionHoggie[]): CollectionCrest {
  const firstFinds = roster.flatMap((onRoster) => hoggies.find(({ hoggie }) => hoggie === onRoster)?.firstAt ?? []);
  const collectedAt = firstFinds.length === roster.length ? Math.max(...firstFinds) : null;
  return { crest, name, art: { kind: "crest", slug: crest }, roster: [...roster], held: firstFinds.length, collectedAt, seen: collectedAt === null ? null : `crest:${crest}:${collectedAt}` };
}

function collectionWith(finds: Record<string, Find>, { crests }: { crests: boolean } = { crests: true }): Collection {
  const hoggies = catalogue.hoggies.map(({ hoggie, rarity }) => hoggieOf(hoggie, rarity, finds[hoggie]));
  const held = hoggies.filter(({ count }) => count > 0);
  const shares = rarities.map(({ rarity, weight }): RarityShare => ({ rarity, chance: weight, owned: held.filter((hoggie) => hoggie.rarity === rarity).length, total: hoggies.filter((hoggie) => hoggie.rarity === rarity).length }));
  const collection: Collection = { kind: "collection", rarities: shares, hoggies, owned: held.length, total: hoggies.length };
  return crests ? { ...collection, crests: catalogue.crests.map((entry) => crestOf(entry, hoggies)) } : collection;
}

const storeOffering = (next: number) => ({ price: 50, next });

const everyHoggieFound = Object.fromEntries(catalogue.hoggies.map(({ hoggie }, index) => [hoggie, { count: 1 + (index % 3), firstAt: `2026-0${1 + (index % 9)}-1${index % 10}T09:00:00Z` }]));

export const collectionFixtures = {
  collection: collectionWith(found),
  collectionWithoutCrests: collectionWith(found, { crests: false }),
  withTheStore: { ...collectionWith(found), bought: ["bought:1", "bought:2"], crateStore: storeOffering(3) },
  withTheStoreAndNothingWaiting: { ...collectionWith(found), bought: [], crateStore: storeOffering(1) },
  withTheStoreWhileCoinsAreHidden: { ...collectionWith(found), bought: ["bought:1"], crateStore: null },
  withTheStickerBook: { ...collectionWith(found), stickers, albums },
  withStickersOnly: { ...collectionWith(found), stickers },
  withNoStickersYet: { ...collectionWith(found), stickers: [], albums: albums.map((album) => ({ ...album, held: 0, people: album.people.map((person) => ({ ...person, held: false })) })) },
  withNoStickersAndNoAlbums: { ...collectionWith(found), stickers: [] },
  withTeamPages: { ...collectionWith(found, { crests: false }), stickers: teamStickers, teams: teamPages },
  withTheStoreAndTheStickerBook: { ...collectionWith(found), bought: ["bought:1", "bought:2"], crateStore: storeOffering(3), stickers, albums },
  withFourPacks: { ...collectionWith(found), bought: ["bought:1", "bought:2", "bought:3", "bought:4"], crateStore: storeOffering(5), stickers, albums },
  withFourPacksAndTeamPages: { ...collectionWith(found, { crests: false }), bought: ["bought:1", "bought:2", "bought:3", "bought:4"], crateStore: storeOffering(5), stickers: teamStickers, teams: teamPages },
  nothingFound: collectionWith({}),
  complete: collectionWith(everyHoggieFound),
  locked: { kind: "locked", level: 1 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyCollection>;

export function fixedCollection(answer: MyCollection): CollectionRead {
  return (asking) => (asking ? answer : undefined);
}

export function fixtureCollectionFor(visitor: ShellState): CollectionRead {
  return fixedCollection(collectionAnswerFor(visitor));
}

function collectionAnswerFor(visitor: ShellState): MyCollection {
  if (visitor.kind !== "member") return collectionFixtures.notFound;
  const card = visitor.features?.find(({ feature }) => feature === "book");
  if (card === undefined) return collectionFixtures.notFound;
  if (card.state === "locked") return { kind: "locked", level: card.level };
  if (card.state === "ready") return collectionFixtures.ready;
  if (showsTheBookSpread(visitor)) return collectionFixtures.withFourPacksAndTeamPages;
  return visitor.coins === null ? collectionFixtures.withTheStickerBook : collectionFixtures.withTheStoreAndTheStickerBook;
}

const packDrops = ["doctor", "wizard", "banana", "surfer"];

export function fixturePackDropOf(crate: string): Drop {
  const n = Number(crate.split(":")[1] ?? 1);
  const slug = packDrops[(n - 1) % packDrops.length]!;
  const hoggie = collectionFixtures.withFourPacks.hoggies.find((entry) => entry.hoggie === slug)!;
  return { hoggie: slug, name: hoggie.name, rarity: hoggie.rarity, art: hoggie.art, copy: hoggie.count + 1, isNew: hoggie.count === 0, crest: null };
}
