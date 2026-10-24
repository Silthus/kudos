import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const inventoryModule = "/convex/store/inventory.ts";
const buyingModule = "/convex/store/buying.ts";

test("ST5 ST6 ST13: only the store writes the collection and item purchases, and the collection and purchases are insert-only", () => {
  const touching = (tables: string) =>
    Object.entries(sources)
      .filter(([, source]) => new RegExp(`\\(\\s*["'](${tables})["']`).test(source))
      .map(([path]) => path);

  expect(touching("collection")).toEqual([inventoryModule]);
  expect(touching("itemPurchases")).toEqual([buyingModule]);
  expect(sources[inventoryModule]).toContain('ctx.db.insert("collection"');
  expect(sources[buyingModule]).toContain('ctx.db.insert("itemPurchases"');
  for (const module of [inventoryModule, buyingModule]) expect(sources[module]).not.toMatch(/\.(replace|delete|patch)\(/);
});
