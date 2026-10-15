import { assets } from "@posthog/brand/hoggies/metadata";
import type { Collection, CollectionHoggie, CollectionRead, MyCollection, RarityShare } from "./collectionRead";
import type { Rarity } from "./crates/drops";
import type { ShellState } from "./shell";

const at = (iso: string) => Date.parse(iso);

const catalogueByRarity: ReadonlyArray<{ rarity: Rarity; chance: number; slugs: string[] }> = [
  { rarity: "common", chance: 50, slugs: ["asleep", "ball", "banana", "beaker", "burger", "card", "cereal", "chart", "coconut", "code-bubble", "coffee-cup", "coffee-run", "commuter", "construction", "croissant", "cursor", "doll-house", "error", "experiment", "gardener", "heart", "honey", "hooligan", "hoot", "hot-popcorn", "hourglass", "ipad", "lemonade", "magnifying-glass", "mailbox", "megaphone", "money", "office-worker", "organized", "panic", "party", "pearl-necklace", "phone-call", "reading", "remote-work", "research", "self-driving", "selfie", "shocked", "sitting", "sleepy", "soccer-coach", "speaker", "stamp-approved", "stamp-denied", "star", "stop", "success", "sunburn", "survey", "toilet", "traffic-police", "trenchcoat", "waiter", "workflows"] },
  { rarity: "uncommon", chance: 28, slugs: ["basketball-coach", "burning-money", "cake", "caribana", "chef", "climber", "coding-group", "cowboy-lasso", "dadd-ai", "data-thief", "doctor", "drake-nah", "drake-yah", "dynamite", "einstein", "explorer", "float", "football-coach", "football-player", "gravedigger", "greek", "haha-bizzniss", "hand-clasp", "hipster", "judge", "lemon-wrangler", "lifeguard", "loops", "namaste", "pit-viper", "reporter", "safari", "scientist", "scorpion", "soapbox", "surfer", "swimmer", "tourist", "town-crier", "traffic-controller"] },
  { rarity: "rare", chance: 14, slugs: ["70s-dance", "996", "ape", "art-thief", "boombox", "business-evolution", "campfire-cowboy", "caveman", "cool-car", "desk-wizard", "director", "dj", "doc-brown", "einstein-group", "gatsby", "hogpatch", "im-the-driver", "mountie", "mr-potato-head", "noir", "pinata", "puzzle", "reading-is-magic", "robot", "roller-coaster", "rose", "sailor", "two-player", "will-smith", "x-ray"] },
  { rarity: "epic", chance: 6, slugs: ["angel", "back-to-the-future", "driving-hogzilla", "evel", "gladiator", "jack-dawson", "katy-perry", "level-up", "oprah", "pope", "reaper", "scott-pilgrim", "steve-jobs", "terminator", "the-bride"] },
  { rarity: "legendary", chance: 2, slugs: ["dr-manhattan", "final-evolution", "rocket", "superhero", "transformer", "wizard"] },
];

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

function collectionWith(finds: Record<string, Find>): Collection {
  const hoggies = catalogueByRarity.flatMap(({ rarity, slugs }) => slugs.map((slug) => hoggieOf(slug, rarity, finds[slug])));
  const held = hoggies.filter(({ count }) => count > 0);
  const rarities = catalogueByRarity.map(({ rarity, chance, slugs }): RarityShare => ({ rarity, chance, owned: held.filter((hoggie) => hoggie.rarity === rarity).length, total: slugs.length }));
  return { kind: "collection", rarities, hoggies, owned: held.length, total: hoggies.length };
}

const everyHoggieFound = Object.fromEntries(catalogueByRarity.flatMap(({ slugs }) => slugs.map((slug, index) => [slug, { count: 1 + (index % 3), firstAt: `2026-0${1 + (index % 9)}-1${index % 10}T09:00:00Z` }])));

export const collectionFixtures = {
  collection: collectionWith(found),
  nothingFound: collectionWith({}),
  complete: collectionWith(everyHoggieFound),
  locked: { kind: "locked", level: 4 },
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
  const card = visitor.kind === "member" ? visitor.features?.find(({ feature }) => feature === "book") : undefined;
  if (card === undefined) return collectionFixtures.notFound;
  if (card.state === "locked") return { kind: "locked", level: card.level };
  if (card.state === "ready") return collectionFixtures.ready;
  return collectionFixtures.collection;
}
