import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const effectsModule = "/convex/progression/effects.ts";

test("P8: effects records are only ever inserted, never changed or deleted", () => {
  const touchingEffects = Object.entries(sources)
    .filter(([, source]) => /["']effectsRecords["']/.test(source))
    .map(([path]) => path);
  const effectsSource = sources[effectsModule] ?? "";

  expect(touchingEffects).toEqual([effectsModule]);
  expect(effectsSource).toContain('ctx.db.insert("effectsRecords"');
  expect(effectsSource).not.toMatch(/\.(patch|replace|delete)\(/);
});
