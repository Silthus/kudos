// PROTOTYPE (#625): the collection book as one list of two-page spreads, each with its own real address. Never merge to main.
import type { ReactNode } from "react";
import type { CollectionTeamPage } from "../../collectionRead";
import type { LadderCard, Rarity } from "../../shell";
import { rarityOrder, type World } from "../world";
import { AchievementsPage, BagPage, HoggiePage, ShopPage, TeamCoverPage, TeamPeoplePage } from "./pages";

export type Chapter = Rarity | "teams" | "achievements" | "store";

export type Spread = { chapter: Chapter; href: string; left: ReactNode; right: ReactNode };

export type BookActions = { buyPack(): void; openPack(id: string): void };

const hoggiesPerPage = 12;

const laddersPerPage = 3;

export const chapterLabel: Record<Chapter, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  teams: "Teams",
  achievements: "Achievements",
  store: "Store",
};

export function spreadsOf(world: World, actions: BookActions): Spread[] {
  return [...rarityOrder.flatMap((rarity) => hoggieSpreads(world, rarity)), ...world.teams.map(teamSpread), ...achievementSpreads(world.achievements), storeSpread(world, actions)];
}

function hoggieSpreads(world: World, rarity: Rarity): Spread[] {
  const hoggies = world.hoggies.filter((hoggie) => hoggie.rarity === rarity);
  const share = world.rarities.find((entry) => entry.rarity === rarity);
  const pages = chunks(hoggies, hoggiesPerPage);
  return chunks(pages, 2).map(([left = [], right = []], index) => ({
    chapter: rarity,
    href: `/book#hoggies/${rarity}/${index + 1}`,
    left: <HoggiePage rarity={rarity} hoggies={left} owned={share?.owned ?? 0} total={share?.total ?? 0} folio={index * 2 + 1} />,
    right: <HoggiePage rarity={rarity} hoggies={right} owned={share?.owned ?? 0} total={share?.total ?? 0} folio={index * 2 + 2} />,
  }));
}

function teamSpread(team: CollectionTeamPage): Spread {
  return { chapter: "teams", href: `/book#teams/${team.team}`, left: <TeamCoverPage team={team} />, right: <TeamPeoplePage team={team} /> };
}

function achievementSpreads(ladders: LadderCard[]): Spread[] {
  return chunks(chunks(ladders, laddersPerPage), 2).map(([left = [], right = []], index) => ({
    chapter: "achievements",
    href: index === 0 ? "/book/earned" : `/book/earned#${index + 1}`,
    left: <AchievementsPage ladders={left} folio={index * 2 + 1} />,
    right: <AchievementsPage ladders={right} folio={index * 2 + 2} />,
  }));
}

function storeSpread(world: World, actions: BookActions): Spread {
  return { chapter: "store", href: "/book#store", left: <ShopPage coins={world.coins} price={world.store.price} onBuy={actions.buyPack} />, right: <BagPage packs={world.packs} onOpen={actions.openPack} /> };
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

export function spreadIndexAt(spreads: Spread[], address: { pathname: string; hash: string }) {
  const href = address.pathname.endsWith("/book/earned") ? `/book/earned${address.hash === "#1" ? "" : address.hash}` : `/book${address.hash}`;
  const exact = spreads.findIndex((spread) => spread.href === href);
  if (exact >= 0) return exact;
  const chapter = chapterIn(href);
  return Math.max(0, spreads.findIndex((spread) => spread.chapter === chapter));
}

function chapterIn(href: string): Chapter | null {
  if (href.startsWith("/book/earned")) return "achievements";
  const [head, tail] = href.replace(/^\/book#?/, "").split("/");
  if (head === "teams") return "teams";
  if (head === "store") return "store";
  return rarityOrder.find((rarity) => rarity === tail) ?? null;
}

export function firstSpreadOf(spreads: Spread[], chapter: Chapter) {
  return spreads.find((spread) => spread.chapter === chapter)?.href ?? "/book";
}

export const chapters: Chapter[] = [...rarityOrder, "teams", "achievements", "store"];
