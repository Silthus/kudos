import { expect, test } from "vitest";
import { CANOPY_COLOURS, CREW_PARTS, DISTRICT_STYLES } from "../../../convex/lib/crewCatalogue";
import { PALETTE, mapHeight, mapWidth, type PixelMap } from "../pixels";
import { GROUND } from "../tiles";
import {
  bannerCloth,
  CANOPY_COLOURS_PALETTE,
  DISTRICT_STYLE_GROUND,
  partThumbnail,
  plaqueSprite,
  STATUE_PLINTH_TOP,
  statuePlinth,
  STRUCTURE_SPRITES,
  WINDMILL_HUB,
  windmillSails,
} from "./crewParts";

/**
 * The crew's parts (#161): structures that stand by their districts, the plaque, the statue's
 * plinth, the banner's cloth, the looks a district style and a canopy colour give, and a 24 × 24
 * thumbnail of every part for the catalogue.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** Equal-length rows, something drawn, and every character a colour (its own or the world's). */
function expectWellFormed(m: PixelMap, name: string) {
  expect(m.rows.length, name).toBeGreaterThan(0);
  expect(new Set(m.rows.map((r) => r.length)), name).toEqual(new Set([mapWidth(m)]));
  const used = new Set(m.rows.join("").replace(/\./g, ""));
  expect(used.size, name).toBeGreaterThan(0);
  for (const ch of used) expect(m.palette?.[ch] ?? PALETTE[ch], `${name} "${ch}"`).toMatch(HEX);
}

test("every structure is a well-formed prop 24–48 px wide and no taller than 56", () => {
  const ids = CREW_PARTS.filter((p) => p.kind === "structure").map((p) => p.id);
  expect(Object.keys(STRUCTURE_SPRITES).sort()).toEqual([...ids].sort());
  for (const [id, m] of Object.entries(STRUCTURE_SPRITES)) {
    expectWellFormed(m, id);
    expect(mapWidth(m), id).toBeGreaterThanOrEqual(24);
    expect(mapWidth(m), id).toBeLessThanOrEqual(48);
    expect(mapHeight(m), id).toBeLessThanOrEqual(56);
  }
});

test("the windmill's sails turn through four same-sized frames round a hub on the tower", () => {
  const frames = [0, 1, 2, 3].map(windmillSails);
  for (const [i, f] of frames.entries()) expectWellFormed(f, `sails ${i}`);
  const size = [mapWidth(frames[0]), mapHeight(frames[0])];
  expect(size[0]).toBe(size[1]);
  for (const f of frames) expect([mapWidth(f), mapHeight(f)]).toEqual(size);
  expect(new Set(frames.map((f) => f.rows.join("\n"))).size).toBe(4);
  // The cycle repeats every four frames.
  expect(windmillSails(5)).toEqual(frames[1]);
  const tower = STRUCTURE_SPRITES.structure_windmill;
  expect(tower.rows[WINDMILL_HUB.y][WINDMILL_HUB.x]).not.toBe(".");
});

test("the plaque, the statue's plinth and the banner are well formed", () => {
  const plaque = plaqueSprite();
  expectWellFormed(plaque, "plaque");
  expect(mapWidth(plaque)).toBeGreaterThanOrEqual(30);
  expect(mapWidth(plaque)).toBeLessThanOrEqual(40);
  expect(mapHeight(plaque)).toBeLessThanOrEqual(46);

  const plinth = statuePlinth();
  expectWellFormed(plinth, "plinth");
  expect(mapWidth(plinth)).toBeLessThanOrEqual(32);
  expect(mapHeight(plinth)).toBeLessThanOrEqual(24);
  expect(plinth.rows[STATUE_PLINTH_TOP.y][STATUE_PLINTH_TOP.x]).not.toBe(".");

  for (const w of [24, 60, 120]) {
    const cloth = bannerCloth(w);
    expectWellFormed(cloth, `banner ${w}`);
    expect([mapWidth(cloth), mapHeight(cloth)]).toEqual([w, 12]);
  }
});

test("every part has a 24 × 24 thumbnail, for each of its options", () => {
  for (const part of CREW_PARTS) {
    const options: (string | undefined)[] = "options" in part ? [undefined, ...part.options] : [undefined];
    for (const option of options) {
      const m = partThumbnail(part.kind, part.id, option);
      const name = `${part.id} ${option ?? ""}`;
      expectWellFormed(m, name);
      expect([mapWidth(m), mapHeight(m)], name).toEqual([24, 24]);
    }
  }
  // With no option a style shows its first.
  expect(partThumbnail("district_style", "style_homes")).toEqual(partThumbnail("district_style", "style_homes", DISTRICT_STYLES[0]));
});

test("every district style recolours the lawn and path and scatters its accents", () => {
  const groundHexes = new Set([...GROUND.lawn, ...GROUND.path].flatMap((m) => [...new Set(m.rows.join(""))].map((ch) => PALETTE[ch])));
  expect(Object.keys(DISTRICT_STYLE_GROUND).sort()).toEqual([...DISTRICT_STYLES].sort());
  for (const style of DISTRICT_STYLES) {
    const { recolour, sprinkle } = DISTRICT_STYLE_GROUND[style];
    for (const [from, to] of Object.entries(recolour)) {
      expect(groundHexes.has(from), `${style} ${from}`).toBe(true);
      expect(to, style).toMatch(HEX);
    }
    for (const ch of ["g", "G", "u"]) expect(recolour[PALETTE[ch]], `${style} ${ch}`).toMatch(HEX);
    expect(sprinkle.length, style).toBeGreaterThan(0);
    for (const s of sprinkle) {
      expect(s.hex).toMatch(HEX);
      expect(s.chance).toBeGreaterThan(0);
      expect(s.chance).toBeLessThan(0.1);
    }
  }
});

test("every canopy colour recolours the leaves and keeps their rim dark", () => {
  expect(Object.keys(CANOPY_COLOURS_PALETTE).sort()).toEqual([...CANOPY_COLOURS].sort());
  const brightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
  for (const colour of CANOPY_COLOURS) {
    const p = CANOPY_COLOURS_PALETTE[colour];
    for (const ch of ["g", "G", "u", "k"] as const) expect(p[ch], `${colour} ${ch}`).toMatch(HEX);
    expect(brightness(p.k), colour).toBeLessThan(50);
    expect(brightness(p.G), colour).toBeLessThan(brightness(p.g));
    expect(brightness(p.g), colour).toBeLessThan(brightness(p.u));
  }
});
