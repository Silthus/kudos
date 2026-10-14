import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const inventoryModule = "/convex/store/inventory.ts";

test("ST5 ST6: only the store writes the collection and the loadout, and the collection is insert-only", () => {
  const touchingTheInventory = Object.entries(sources)
    .filter(([, source]) => /["'](collection|loadouts)["']/.test(source))
    .map(([path]) => path);
  const inventorySource = sources[inventoryModule] ?? "";

  expect(touchingTheInventory).toEqual([inventoryModule]);
  expect(inventorySource).toContain('ctx.db.insert("collection"');
  expect(inventorySource).not.toMatch(/\.(replace|delete|patch)\(/);
});
