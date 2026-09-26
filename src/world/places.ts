import { isActive, type NavBadge, type NavItem } from "@/lib/nav";
import type { Tile } from "./iso";
import type { PixelMap } from "./pixels";
import type { Terrain } from "./world";
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
import { place as offering } from "./places/offering";

/**
 * The places of the world (#126 "The world"): every page is a place you walk to, and arriving opens
 * its window. A place shows exactly when its page is in the navigation (`navItems`) and the tree
 * has opened its district (#156), and its id is the nav id, so the route, condition and badge still
 * live in `src/lib/nav.ts` only.
 *
 * ## The place-file contract
 *
 * Each place is one self-contained file, `places/<id>.ts`, exporting `place: PlaceDef`. Its tiles
 * are counted from its district's **anchor**, (0, 0): the tree's layout (`convex/lib/tree.ts`,
 * `api.tree.state().layout`) says where each district stands, and `world.ts` settles the place
 * there (`placeAt`), so no place file knows where on the tree it hangs.
 *
 * - `id`: the nav id (`me`, `quests`, …); `name`: the name on its sign and window title.
 * - `footprint`: the tiles it stands on (x/y from the anchor, w/h), blocked for walking unless
 *   `walkable`, and only while the place stands on the viewer's map. `terrain: "water"` floods the
 *   footprint; `ground` lays a place's own ground on it (the garden's fence, gates and plots).
 * - `doors`: the tiles the hedgehog stands on to go in; each touches the footprint, on its front
 *   (the +x or +y side) so the hedgehog is drawn in front of the building (flat places, like the
 *   pond, may use any side). The world lays a path from base camp to each open door on its own.
 *   `world.test.ts` checks, across many trees, that no two places overlap and every open door is
 *   reachable from base camp; `signs.test.ts` that no sign covers a door.
 * - `sprite`: a palette-indexed `PixelMap` (see `pixels.ts`), our own art, never a hedgehog. It's
 *   drawn with its bottom centre on the footprint's front corner, or on `spriteAt`'s tile, plus
 *   `spriteOffset` (art pixels). The sign with the place's name hangs above it, or at `signOffset`.
 *
 * To redraw a place, a place lane edits only its own file. A new place adds its file, one import
 * line below, and its id to its district's `places` in `convex/lib/tree.ts`.
 */
/** A place's own ground, tile by tile from its anchor; null leaves the world's. */
export type PlaceGround = (x: number, y: number) => Terrain | null;

export type PlaceDef = {
  id: string;
  name: string;
  footprint: { x: number; y: number; w: number; h: number };
  doors: Tile[];
  sprite: PixelMap;
  walkable?: boolean;
  terrain?: "water";
  ground?: PlaceGround;
  spriteAt?: Tile;
  spriteOffset?: { x: number; y: number };
  /** Where the name sign stands, in art pixels from the sprite's top centre. */
  signOffset?: { x: number; y: number };
};

export const PLACES: PlaceDef[] = [garden, me, offering, quests, leaderboard, compare, discoveries, store, skills, analytics, admin, playground];

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

/**
 * The places standing on the map (settled by `world.ts`) with their page's link, path and badge: a
 * standing place is one of `routable`, where the tree put it.
 */
export function placesOnMap(standing: PlaceDef[], routable: Place[]): Place[] {
  return standing.flatMap((def) => {
    const nav = routable.find((p) => p.id === def.id);
    return nav ? [{ ...nav, ...def }] : [];
  });
}

/** Where a URL takes you: its place, and for `/garden/:memberId` whose bed. Null for the map itself. */
export function placeForPath(pathname: string, places: Place[]): { place: Place; memberId?: string } | null {
  const place = places.find((p) => isActive({ path: p.path } as NavItem, pathname));
  if (!place) return null;
  const member = place.id === "garden" ? /^\/garden\/([^/]+)/i.exec(pathname)?.[1] : undefined;
  return member ? { place, memberId: decodeURIComponent(member) } : { place };
}

/** A place settled at a tile (its district's anchor): its footprint, doors, sprite tile and ground moved there. */
export function placeAt<P extends PlaceDef>(def: P, at: Tile): P {
  const move = (t: Tile) => ({ x: t.x + at.x, y: t.y + at.y });
  const ground = def.ground;
  return {
    ...def,
    footprint: { ...def.footprint, x: def.footprint.x + at.x, y: def.footprint.y + at.y },
    doors: def.doors.map(move),
    spriteAt: def.spriteAt && move(def.spriteAt),
    ground: ground && ((x: number, y: number) => ground(x - at.x, y - at.y)),
  };
}
