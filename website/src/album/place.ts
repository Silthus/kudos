import { rarestFirst } from "../book/spread/spreads";
import type { Rarity } from "../crates/drops";
import type { BookPageId, Route, SettingsSection } from "../route";
import type { Album, BoardPeriod } from "./answer";

export type Place =
  | { kind: "team"; team: string }
  | { kind: "person"; person: string }
  | { kind: "profile" }
  | { kind: "hoggies"; hoggie: string | null; rarity?: Rarity }
  | { kind: "milestones" }
  | { kind: "packs" }
  | { kind: "levelUp"; level: number }
  | { kind: "activity"; week?: string }
  | { kind: "leaderboard"; period?: BoardPeriod }
  | { kind: "settings"; section?: SettingsSection }
  | { kind: "elsewhere" };

export const home: Place = { kind: "profile" };

export function placeOf(route: Route, hash: string, landingState: unknown): Place {
  switch (route.page) {
    case "home":
      return home;
    case "book":
      return albumPlaceIn(hash, landingState) ?? spreadPlaceIn(hash) ?? bookPagePlaceOf(route.bookPage);
    case "activity":
      return route.week === undefined ? { kind: "activity" } : { kind: "activity", week: route.week };
    case "leaderboard":
      return route.period === "week" ? { kind: "leaderboard" } : { kind: "leaderboard", period: route.period };
    case "settings":
      return route.section === undefined ? { kind: "settings" } : { kind: "settings", section: route.section };
    case "quests":
    case "skills":
      return home;
    case "not-found":
      return { kind: "elsewhere" };
  }
}

export type MyPage = string | null;

export function myPageOf(album: Album | undefined): MyPage {
  return album?.shareableUrls === true ? album.me.person : null;
}

export function placeShownAt(place: Place, myPage: MyPage): Place {
  if (myPage === null) return withoutItsView(place);
  return place.kind === "person" && place.person === myPage ? home : place;
}

export function addressOf(place: Place, myPage: MyPage): string {
  return myPage !== null && place.kind === "profile" ? hrefOf({ kind: "person", person: myPage }) : hrefOf(place);
}

function withoutItsView(place: Place): Place {
  if (place.kind === "activity" || place.kind === "leaderboard") return { kind: place.kind };
  return place;
}

const pageSections = new Set(["teams", "people", "me", "hoggies", "milestones", "packs", "level-up"]);

export function isAnAlbumHash(hash: string) {
  return pageSections.has(hash.replace(/^#/, "").split("/", 1)[0]!);
}

function albumPlaceIn(hash: string, landingState: unknown): Place | undefined {
  const [section, key] = hash.replace(/^#/, "").split("/", 2).map(decoded);
  if (section === "teams" && key) return isARetiredGroupAlbum(key) ? home : { kind: "team", team: key };
  if (section === "people" && key) return { kind: "person", person: key };
  if (section === "me") return { kind: "profile" };
  if (section === "hoggies") return hoggiesPlaceOf(key || null, landingState);
  if (section === "milestones") return { kind: "milestones" };
  if (section === "packs") return { kind: "packs" };
  if (section === "level-up") return levelUpPlaceOf(key);
  return undefined;
}

function levelUpPlaceOf(key: string | undefined): Place | undefined {
  const level = Number(key);
  return key && Number.isSafeInteger(level) && level > 1 ? { kind: "levelUp", level } : undefined;
}

function isARetiredGroupAlbum(team: string) {
  return team.startsWith("group:");
}

function hoggiesPlaceOf(key: string | null, landingState: unknown): Place {
  const landedRarity = rarityIn(key);
  if (landedRarity !== undefined) return { kind: "hoggies", hoggie: null, rarity: landedRarity };
  const filtered = filteredRarityIn(landingState);
  return filtered === undefined ? { kind: "hoggies", hoggie: key } : { kind: "hoggies", hoggie: key, rarity: filtered };
}

function rarityIn(asked: unknown): Rarity | undefined {
  return rarestFirst.find((rarity) => rarity === asked);
}

function filteredRarityIn(landingState: unknown): Rarity | undefined {
  return typeof landingState === "object" && landingState !== null && "rarity" in landingState ? rarityIn(landingState.rarity) : undefined;
}

export function landingStateOf(place: Place): { rarity: Rarity } | null {
  return place.kind === "hoggies" && place.rarity !== undefined ? { rarity: place.rarity } : null;
}

function spreadPlaceIn(hash: string): Place | undefined {
  const section = hash.replace(/^#/, "").split("/", 1)[0];
  if (section === "cover" || section === "teams") return home;
  if (section === "achievements") return { kind: "milestones" };
  return undefined;
}

function bookPagePlaceOf(bookPage: BookPageId): Place {
  if (bookPage === "overview") return home;
  if (bookPage === "collection") return { kind: "hoggies", hoggie: null };
  return { kind: "milestones" };
}

function decoded(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function hrefOf(place: Place): string {
  switch (place.kind) {
    case "team":
      return `/book#teams/${encodeURIComponent(place.team)}`;
    case "person":
      return `/book#people/${encodeURIComponent(place.person)}`;
    case "profile":
      return "/book#me";
    case "hoggies":
      return place.hoggie === null ? "/book#hoggies" : `/book#hoggies/${encodeURIComponent(place.hoggie)}`;
    case "milestones":
    case "packs":
      return `/book#${place.kind}`;
    case "levelUp":
      return `/book#level-up/${place.level}`;
    case "settings":
      return place.section === undefined ? "/settings" : `/settings?section=${place.section}`;
    case "activity":
      return place.week === undefined ? "/activity" : `/activity?week=${place.week}`;
    case "leaderboard":
      return place.period === undefined ? "/leaderboard" : `/leaderboard?period=${place.period}`;
    case "elsewhere":
      return "/";
  }
}

export const findYourselfHref = hrefOf({ kind: "settings", section: "company-profile" });

export function keyOf(place: Place): string {
  if (place.kind === "hoggies") return hrefOf({ kind: "hoggies", hoggie: null });
  return hrefOf(withoutItsView(place)) + (place.kind === "elsewhere" ? "#elsewhere" : "");
}
