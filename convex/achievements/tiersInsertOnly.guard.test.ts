import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const tiersModule = "/convex/achievements/tiers.ts";

test("P61: earned tiers are only ever inserted, never changed or deleted", () => {
  const touchingTiers = Object.entries(sources)
    .filter(([, source]) => /["']earnedTiers["']/.test(source))
    .map(([path]) => path);
  const tiersSource = sources[tiersModule] ?? "";

  expect(touchingTiers).toEqual([tiersModule]);
  expect(tiersSource).toContain('ctx.db.insert("earnedTiers"');
  expect(tiersSource).not.toMatch(/\.(patch|replace|delete)\(/);
});
