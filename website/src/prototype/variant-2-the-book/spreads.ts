// PROTOTYPE (#625): the book's page order: every chapter, spread and address. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage } from "../../collectionRead";
import type { Rarity } from "../../shell";
import { rarityOrder, type World } from "../world";

export type ChapterId = "contents" | "hoggies" | "teams" | "quests" | "earned" | "store" | "activity" | "leaderboard" | "settings";

export type PageView =
  | { kind: "contents-plate" }
  | { kind: "contents-index" }
  | { kind: "hoggies"; key: string; rarity: Rarity; sheet: number; sheets: number; hoggies: CollectionHoggie[] }
  | { kind: "team-title"; team: CollectionTeamPage }
  | { kind: "team-stickers"; team: CollectionTeamPage }
  | { kind: "quests-now" }
  | { kind: "quests-done" }
  | { kind: "earned"; half: 0 | 1 }
  | { kind: "store-packs" }
  | { kind: "store-counter" }
  | { kind: "activity-received" }
  | { kind: "activity-given" }
  | { kind: "board-podium" }
  | { kind: "board-list" }
  | { kind: "settings-intro" }
  | { kind: "settings-sheet" }
  | { kind: "endpaper" };

export type NumberedPage = PageView & { number: number };

export type Spread = { chapter: ChapterId; address: string; keys: string[]; left: NumberedPage; right: NumberedPage };

export type Chapter = { id: ChapterId; name: string; tier: "core" | "secondary" | "deep" | "admin"; address: string };

export const chapters: Chapter[] = [
  { id: "hoggies", name: "Hoggies", tier: "core", address: "/book#hoggies" },
  { id: "teams", name: "Teams", tier: "core", address: "/book#teams" },
  { id: "quests", name: "Quests", tier: "core", address: "/quests" },
  { id: "earned", name: "Achievements", tier: "secondary", address: "/book/earned" },
  { id: "store", name: "Store", tier: "secondary", address: "/book#store" },
  { id: "activity", name: "Activity", tier: "deep", address: "/activity" },
  { id: "leaderboard", name: "Leaderboard", tier: "deep", address: "/leaderboard" },
  { id: "settings", name: "Settings", tier: "admin", address: "/settings" },
];

export const hoggiesPerSheet = 25;

type Draft = { chapter: ChapterId; address: string; keys: string[]; left: PageView; right: PageView };

function hoggieSheetsOf(hoggies: CollectionHoggie[]): Extract<PageView, { kind: "hoggies" }>[] {
  return rarityOrder.flatMap((rarity) => {
    const ofRarity = hoggies.filter((hoggie) => hoggie.rarity === rarity);
    const sheets = Math.max(1, Math.ceil(ofRarity.length / hoggiesPerSheet));
    const perSheet = Math.ceil(ofRarity.length / sheets);
    return Array.from({ length: sheets }, (_, index) => ({ kind: "hoggies" as const, key: `${rarity}-${index + 1}`, rarity, sheet: index + 1, sheets, hoggies: ofRarity.slice(index * perSheet, (index + 1) * perSheet) }));
  });
}

function pairedHoggieSpreads(hoggies: CollectionHoggie[]): Draft[] {
  const sheets = hoggieSheetsOf(hoggies);
  const drafts: Draft[] = [];
  for (let index = 0; index < sheets.length; index += 2) {
    const left = sheets[index]!;
    const right = sheets[index + 1];
    drafts.push({ chapter: "hoggies", address: `/book#hoggies/${left.key}`, keys: right === undefined ? [left.key] : [left.key, right.key], left, right: right ?? { kind: "endpaper" } });
  }
  return drafts;
}

function teamSpreads(teams: CollectionTeamPage[]): Draft[] {
  return teams.map((team) => ({ chapter: "teams", address: `/book#teams/${team.team}`, keys: [team.team], left: { kind: "team-title", team }, right: { kind: "team-stickers", team } }));
}

function single(chapter: ChapterId, address: string, left: PageView, right: PageView): Draft {
  return { chapter, address, keys: [], left, right };
}

export function spreadsOf(world: World): Spread[] {
  const drafts: Draft[] = [
    single("contents", "/book", { kind: "contents-plate" }, { kind: "contents-index" }),
    ...pairedHoggieSpreads(world.hoggies),
    ...teamSpreads(world.teams),
    single("quests", "/quests", { kind: "quests-now" }, { kind: "quests-done" }),
    single("earned", "/book/earned", { kind: "earned", half: 0 }, { kind: "earned", half: 1 }),
    single("store", "/book#store", { kind: "store-packs" }, { kind: "store-counter" }),
    single("activity", "/activity", { kind: "activity-received" }, { kind: "activity-given" }),
    single("leaderboard", "/leaderboard", { kind: "board-podium" }, { kind: "board-list" }),
    single("settings", "/settings", { kind: "settings-intro" }, { kind: "settings-sheet" }),
  ];
  return drafts.map((draft, index) => ({ ...draft, left: { ...draft.left, number: index * 2 + 1 }, right: { ...draft.right, number: index * 2 + 2 } }));
}

export function firstSpreadOf(spreads: Spread[], chapter: ChapterId) {
  return Math.max(0, spreads.findIndex((spread) => spread.chapter === chapter));
}

export function spreadIndexAt(spreads: Spread[], pathname: string, hash: string): number {
  const exact = spreads.findIndex((spread) => spread.address === pathname + hash);
  if (exact >= 0) return exact;
  const [chapter, key] = hash.replace(/^#/, "").split("/");
  if (pathname === "/book" && (chapter === "hoggies" || chapter === "teams")) {
    const keyed = spreads.findIndex((spread) => spread.chapter === chapter && key !== undefined && spread.keys.includes(key));
    return keyed >= 0 ? keyed : firstSpreadOf(spreads, chapter);
  }
  if (pathname === "/book" && chapter === "store") return firstSpreadOf(spreads, "store");
  if (pathname === "/book/collection") return firstSpreadOf(spreads, "hoggies");
  if (pathname === "/book/earned" || (pathname === "/book" && window.location.search.includes("page="))) return firstSpreadOf(spreads, "earned");
  const byPath = spreads.findIndex((spread) => spread.address === pathname);
  return byPath >= 0 ? byPath : 0;
}

export function spreadOfHoggie(spreads: Spread[], slug: string) {
  return spreads.findIndex(({ left, right }) => [left, right].some((page) => page.kind === "hoggies" && page.hoggies.some(({ hoggie }) => hoggie === slug)));
}
