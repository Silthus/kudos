import { describe, expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const attributionModule = "/convex/groups/attribution.ts";

describe("GB10: an attribution is only ever inserted, never changed or deleted", () => {
  test("only the attribution module names the table, and it never patches, replaces or deletes a row", () => {
    const touchingAttributions = Object.entries(sources)
      .filter(([path, source]) => path !== "/convex/schema.ts" && /["']attributions["']/.test(source))
      .map(([path]) => path)
      .toSorted();

    expect(touchingAttributions).toEqual([attributionModule]);
    expect(sources[attributionModule]).toContain('ctx.db.insert("attributions"');
    expect(sources[attributionModule]).not.toMatch(/\.(patch|replace|delete)\(/);
  });
});
