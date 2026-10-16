import { describe, expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const transitionsModule = "/convex/groups/transitions.ts";

describe("GB9: the transition log is only ever inserted, never changed or deleted", () => {
  test("only the transitions module names its tables, and it never patches, replaces or deletes a row", () => {
    const touchingLog = Object.entries(sources)
      .filter(([path, source]) => path !== "/convex/schema.ts" && /["'](userGroupDepartures|groupCountingChanges)["']/.test(source))
      .map(([path]) => path)
      .toSorted();

    expect(touchingLog).toEqual([transitionsModule]);
    expect(sources[transitionsModule]).toContain('ctx.db.insert("userGroupDepartures"');
    expect(sources[transitionsModule]).toContain('ctx.db.insert("groupCountingChanges"');
    expect(sources[transitionsModule]).not.toMatch(/\.(patch|replace|delete)\(/);
  });
});
