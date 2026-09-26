import { describe, expect, test } from "vitest";
import { BESTIARY, GEAR_IDS } from "../../../convex/lib/rpg";
import { PALETTE, type PixelMap } from "../pixels";
import { RUIN_ART } from "../places/ruins";
import { CREATURE_ART, unmetArt } from "./bestiary";
import { GEAR_ART } from "./gear";
import { ROOM_ICONS, sceneFor } from "./scenes";

/** The ruins' pixel art (#162): every map is a clean rectangle in the palette, and every creature and piece of gear has one. */
function problems(name: string, m: PixelMap): string[] {
  const width = m.rows[0]?.length ?? 0;
  const out: string[] = [];
  if (width === 0) out.push(`${name} is empty`);
  m.rows.forEach((row, y) => {
    if (row.length !== width) out.push(`${name} row ${y} is ${row.length} wide, not ${width}`);
    for (const ch of row) if (ch !== "." && !(ch in PALETTE) && !(m.palette && ch in m.palette)) out.push(`${name} row ${y} has "${ch}"`);
  });
  if (!m.rows.some((row) => /[^.]/.test(row))) out.push(`${name} draws nothing`);
  return out;
}

describe("the ruins' art", () => {
  test("every creature of the bestiary is drawn, and has a shadow for before it's met", () => {
    for (const c of BESTIARY) {
      expect(problems(c.id, CREATURE_ART[c.id])).toEqual([]);
      expect(problems(`${c.id} unmet`, unmetArt(c.id))).toEqual([]);
    }
    expect(Object.keys(CREATURE_ART).sort()).toEqual(BESTIARY.map((c) => c.id).sort());
  });

  test("every piece of gear is drawn", () => {
    for (const id of GEAR_IDS) expect(problems(id, GEAR_ART[id])).toEqual([]);
  });

  test("every ruin tier, room icon and room scene is drawn", () => {
    for (const [tier, m] of Object.entries(RUIN_ART)) expect(problems(`ruin ${tier}`, m)).toEqual([]);
    for (const [kind, m] of Object.entries(ROOM_ICONS)) expect(problems(`icon ${kind}`, m)).toEqual([]);
    for (const tier of [1, 2, 3]) for (const kind of ["foe", "puzzle", "secret", "rest"] as const) expect(problems(`${kind} ${tier}`, sceneFor(kind, tier))).toEqual([]);
  });
});
