import { isActive, type NavBadge, type NavItem } from "@/lib/nav";
import type { Tile } from "./iso";
import type { PixelMap } from "./pixels";
import { place as garden } from "./places/garden";
import { place as me } from "./places/me";
import { place as quests } from "./places/quests";
import { place as leaderboard } from "./places/leaderboard";
import { place as compare } from "./places/compare";
import { place as discoveries } from "./places/discoveries";
import { place as store } from "./places/store";
import { place as skills } from "./places/skills";
import { place as analytics } from "./places/analytics";
import { place as admin } from "./places/admin";
import { place as playground } from "./places/playground";

/**
 * The places of the world (#126 "The world"): every page is a place you walk to, and arriving opens
 * its window. A place shows exactly when its page is in the navigation (`navItems`), and its id is
 * the nav id, so the route, condition and badge still live in `src/lib/nav.ts` only.
 *
 * ## The place-file contract
 *
 * Each place is one self-contained file, `places/<id>.ts`, exporting `place: PlaceDef`:
 *
 * - `id`: the nav id (`me`, `quests`, …); `name`: the name on its sign and window title.
 * - `footprint`: the tiles it stands on (grid x/y, w/h), blocked for walking unless `walkable`,
 *   and only while the place is on the viewer's map. `terrain: "water"` floods the footprint.
 * - `doors`: the tiles the hedgehog stands on to go in; each touches the footprint, on its front
 *   (the +x or +y side) so the hedgehog is drawn in front of the building (flat places, like the
 *   pond, may use any side), and lies outside the ring road. The map lays a path from each door to
 *   the ring road on its own (`tiles.ts`), round the corner if need be, so moving a place is one
 *   edit. `tiles.test.ts` checks the doors, that the footprints don't overlap and that every door
 *   stays reachable.
 * - `sprite`: a palette-indexed `PixelMap` (see `pixels.ts`), our own art, never a hedgehog. It's
 *   drawn with its bottom centre on the footprint's front corner, or on `spriteAt`'s tile, plus
 *   `spriteOffset` (art pixels). The sign with the place's name hangs above it, or at `signAt`.
 *
 * To redraw a place, a place lane edits only its own file. A new place adds its file and one
 * import line below.
 */
export type PlaceDef = {
  id: string;
  name: string;
  footprint: { x: number; y: number; w: number; h: number };
  doors: Tile[];
  sprite: PixelMap;
  walkable?: boolean;
  terrain?: "water";
  spriteAt?: Tile;
  spriteOffset?: { x: number; y: number };
  /** Where the name sign stands, in art pixels from the sprite's top centre. */
  signOffset?: { x: number; y: number };
};

export const PLACES: PlaceDef[] = [garden, me, quests, leaderboard, compare, discoveries, store, skills, analytics, admin, playground];

/** A place on this viewer's map: its art plus its page's link, path and badge from the nav. */
export type Place = PlaceDef & { to: string; path: string; badge?: NavBadge; label: string };

/** The places whose pages this viewer has, in nav order. */
export function visiblePlaces(items: NavItem[]): Place[] {
  return items.flatMap((item) => {
    const def = PLACES.find((p) => p.id === item.id);
    return def ? [{ ...def, to: item.to, path: item.path, badge: item.badge, label: item.label }] : [];
  });
}

/**
 * Every place a URL may open, whether or not it's on this viewer's map: the router decides which
 * pages exist (the Store opens from a link while the game is on, before it's in the menu), and a
 * page that's open has its place. Visible places keep their nav link and badge.
 */
export function routablePlaces(shown: Place[]): Place[] {
  return PLACES.map((def) => shown.find((p) => p.id === def.id) ?? { ...def, to: `/${def.id}`, path: `/${def.id}`, label: def.name });
}

/** Where a URL takes you: its place, and for `/garden/:memberId` whose bed. Null for the map itself. */
export function placeForPath(pathname: string, places: Place[]): { place: Place; memberId?: string } | null {
  const place = places.find((p) => isActive({ path: p.path } as NavItem, pathname));
  if (!place) return null;
  const member = place.id === "garden" ? /^\/garden\/([^/]+)/i.exec(pathname)?.[1] : undefined;
  return member ? { place, memberId: decodeURIComponent(member) } : { place };
}
