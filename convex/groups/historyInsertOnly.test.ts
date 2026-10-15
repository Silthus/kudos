import { describe, expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const historyModule = "/convex/groups/history.ts";

describe("GB9: the primary group history is only ever inserted, never changed or deleted", () => {
  test("only the history module names the table, and it never patches, replaces or deletes a row", () => {
    const touchingHistory = Object.entries(sources)
      .filter(([path, source]) => path !== "/convex/schema.ts" && /["']primaryGroupHistory["']/.test(source))
      .map(([path]) => path)
      .toSorted();

    expect(touchingHistory).toEqual([historyModule]);
    expect(sources[historyModule]).toContain('ctx.db.insert("primaryGroupHistory"');
    expect(sources[historyModule]).not.toMatch(/\.(patch|replace|delete)\(/);
  });
});
