import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const awardsModule = "/convex/engine/awards.ts";

test("R18: awards are only ever inserted, never changed or deleted", () => {
  const touchingAwards = Object.entries(sources)
    .filter(([, source]) => /(?<!(v\.id\(|Id<))["']awards["']/.test(source))
    .map(([path]) => path);
  const awardsSource = sources[awardsModule] ?? "";

  expect(touchingAwards).toEqual([awardsModule]);
  expect(awardsSource).toContain('ctx.db.insert("awards"');
  expect(awardsSource).not.toMatch(/\.(patch|replace|delete)\(/);
});
