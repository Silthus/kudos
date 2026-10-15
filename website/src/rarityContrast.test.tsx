import { describe, expect, it } from "vitest";
import { contrast } from "./test/themeContrast";

const rarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;

describe("#467 V3 V24: each rarity's colour is a theme token that meets 3:1 on the card and the canvas in both modes", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = rarities.flatMap((rarity) => ["card", "background"].map((surface) => ({ rarity, surface, ratio: contrast(mode, `rarity-${rarity}`, surface) })));
      expect(measured).toHaveLength(10);
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});
