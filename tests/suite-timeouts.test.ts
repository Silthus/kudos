import { expect, test } from "vitest";

/**
 * Seeding the demo is the slowest thing the suite does, and on a busy machine it blew past ad-hoc
 * timeouts. Every test file that enters or resets the demo uses the one shared DEMO_TIMEOUT.
 */
const sources = import.meta.glob<string>("./*.test.ts", { query: "?raw", import: "default", eager: true });

test("every test file that seeds the demo uses DEMO_TIMEOUT", () => {
  const seedsTheDemo = /internal\.demo\.ensureDemoUser|api\.demo\.resetDemo\b/;
  const offenders = Object.entries(sources)
    .filter(([, source]) => seedsTheDemo.test(source) && !source.includes("DEMO_TIMEOUT"))
    .map(([file]) => file);
  expect(offenders).toEqual([]);
  expect(Object.keys(sources).length).toBeGreaterThan(10); // the glob found the suite
});
