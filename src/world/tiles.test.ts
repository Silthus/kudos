import { describe, expect, test } from "vitest";
import { PALETTE } from "./pixels";
import { GROUND, GROUND_OF, NIGHT, groundFrame } from "./tiles";

/** The map itself (connectivity, doors, districts) is `world.test.ts`'s; these are the ground's tiles. */
describe("ground tiles", () => {
  const inPalette = new RegExp(`^[${Object.keys(PALETTE).join("")}]{16}$`);

  test("are 16 × 16 pixel maps in the palette", () => {
    for (const [name, frames] of Object.entries(GROUND)) {
      for (const map of frames) {
        expect(map.rows, name).toHaveLength(16);
        for (const row of map.rows) expect(row, name).toMatch(inPalette);
      }
    }
  });

  test("every terrain has its ground; the desert's is sand-coloured, darkening to night-sand away from the tree", () => {
    for (const ground of Object.values(GROUND_OF)) expect(GROUND).toHaveProperty(ground);
    const sand = GROUND.sand[0].rows.join("");
    expect(sand.split("").filter((c) => c === "a").length).toBeGreaterThan(128);
    for (const [day, night] of Object.entries(NIGHT)) expect([PALETTE[day], PALETTE[night]].every(Boolean), day).toBe(true);
    expect(NIGHT.a).toBe("n");
  });

  test("water shimmers in two frames, slowly; everything else holds still", () => {
    expect(GROUND.water).toHaveLength(2);
    expect(GROUND.water[0].rows).not.toEqual(GROUND.water[1].rows);
    expect(groundFrame(0)).toBe(0);
    expect(groundFrame(900)).toBe(0);
    expect(groundFrame(1300)).toBe(1);
    expect(groundFrame(2600)).toBe(0);
    for (const t of ["sand", "dune", "lawn", "path", "garden"] as const) expect(GROUND[t], t).toHaveLength(1);
  });
});
