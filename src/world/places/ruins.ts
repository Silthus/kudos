import type { RuinSite, RuinTier } from "../../../convex/lib/tree";
import { PixelCanvas, type PixelMap } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The ruins' entrances in the desert (#162, plan #152 S7), one sprite per tier: the near ruins a
 * sunken sandstone arch, the far ruins a half-buried grey tower, the deep ruins a dark stair going
 * down with blight at its lip. A ruin stands where the tree's layout put it (`layout().ruins`);
 * its door is the ruin's own tile, where the path from the tree ends, and walking onto it opens
 * the ruin's window (`/ruins/<tier>-<index>`).
 */

function sunkenArch() {
  const c = new PixelCanvas(56, 46);
  // A dark way in under a sandstone arch, its right pillar broken off, sunk to the knees in sand.
  c.rect(20, 12, 16, 26, "k");
  c.polygon([[20, 12], [28, 5], [36, 12]], "k");
  // The left pillar whole, the right one broken.
  c.rect(11, 10, 9, 28, "a").rect(17, 10, 3, 28, "A");
  c.rect(36, 18, 9, 20, "A").rect(42, 18, 3, 20, "D");
  c.polygon([[36, 18], [39, 15], [42, 17], [45, 16], [45, 18]], "A");
  // The arch: whole on the left, its keystone cracked, falling short on the right.
  c.polygon([[11, 12], [16, 5], [22, 1], [30, 1], [34, 4], [30, 6], [26, 5], [20, 9], [20, 12]], "a");
  c.polygon([[30, 1], [34, 4], [30, 6]], "A");
  c.rect(24, 1, 3, 3, "A").set(25, 4, "k");
  // Courses of stone.
  for (const y of [17, 24, 31]) c.rect(11, y, 9, 1, "D").rect(36, y, 9, 1, y > 18 ? "n" : "D");
  c.rect(14, 5, 2, 1, "D").rect(19, 3, 2, 1, "D");
  // A lintel stone fallen in front, and rubble.
  c.rect(40, 36, 10, 4, "A").rect(40, 36, 10, 1, "a").rect(47, 33, 5, 3, "D").rect(47, 33, 5, 1, "A");
  c.rect(4, 36, 5, 3, "D").rect(4, 36, 5, 1, "A");
  // The sand it sank into, drifted up against the stones.
  c.polygon([[0, 42], [6, 36], [14, 38], [22, 37], [34, 37], [44, 39], [56, 42], [44, 46], [12, 46]], "A");
  c.polygon([[2, 42], [10, 38], [20, 39], [30, 40], [26, 43], [10, 44]], "a");
  return c.outline().map();
}

function buriedTower() {
  const c = new PixelCanvas(52, 60);
  // A round grey tower, leaning, half under the sand, one lit slit window high up.
  c.rect(14, 8, 22, 42, "m").rect(28, 8, 8, 42, "M");
  c.rect(11, 4, 28, 5, "m").rect(31, 4, 8, 5, "M");
  for (const x of [11, 18, 25, 32]) c.rect(x, 0, 4, 4, x >= 31 ? "M" : "m");
  c.rect(22, 0, 3, 4, ".");
  c.rect(23, 14, 2, 6, "l").set(23, 13, "c");
  for (const y of [13, 22, 31, 40]) c.rect(14, y, 14, 1, "M");
  // Its door, half buried, and a crack running down from the battlements.
  c.rect(17, 36, 12, 14, "k");
  c.polygon([[17, 36], [23, 31], [29, 36]], "k");
  c.set(30, 9, "k").set(31, 10, "k").set(30, 11, "k").set(31, 12, "k");
  // Dunes against it.
  c.polygon([[0, 54], [8, 46], [18, 47], [26, 44], [38, 46], [52, 54], [38, 60], [12, 60]], "A");
  c.polygon([[4, 54], [14, 48], [24, 50], [32, 52], [24, 56], [10, 57]], "a");
  return c.outline().map();
}

function darkStair() {
  const c = new PixelCanvas(56, 40);
  c.polygon([[0, 32], [10, 22], [46, 22], [56, 32], [42, 40], [14, 40]], "D");
  // A pit with steps going down into the dark.
  c.polygon([[10, 28], [18, 22], [40, 22], [46, 28], [38, 35], [16, 35]], "k");
  for (let i = 0; i < 5; i++) c.rect(18 + i * 2, 23 + i * 2, 20 - i * 4, 1, i % 2 ? "M" : "m");
  // Broken posts, and the blight creeping over the lip.
  c.rect(7, 6, 5, 20, "M").rect(7, 4, 5, 2, "m");
  c.rect(43, 10, 5, 16, "M").rect(43, 8, 5, 2, "m");
  c.set(16, 22, "x").set(17, 21, "x").set(18, 21, "x").set(39, 22, "x").set(40, 23, "x").set(41, 24, "v").set(15, 23, "v").set(14, 24, "x");
  c.polygon([[2, 32], [10, 27], [16, 36], [8, 38]], "n");
  return c.outline().map();
}

export const RUIN_ART: Record<RuinTier, PixelMap> = { 1: sunkenArch(), 2: buriedTower(), 3: darkStair() };

/** A ruin's page: `/ruins/1-3` for `ruin:1:3`. */
export const ruinPath = (id: string) => `/ruins/${id.replace(/^ruin:/, "").replace(":", "-")}`;
/** The ruin id a `/ruins/<tier>-<index>` path names, or null. */
export function ruinIdOf(pathname: string): string | null {
  const m = /^\/ruins\/([123])-(\d)\/?$/.exec(pathname);
  return m ? `ruin:${m[1]}:${m[2]}` : null;
}

/** A ruin as a place: its sprite on the tile behind its door, the door on the ruin's own tile. */
export function ruinPlace(site: RuinSite): PlaceDef {
  return {
    id: site.id,
    name: site.name,
    footprint: { x: site.at.x - 1, y: site.at.y - 1, w: 1, h: 1 },
    doors: [site.at],
    spriteAt: { x: site.at.x - 1, y: site.at.y - 1 },
    sprite: RUIN_ART[site.tier],
  };
}
