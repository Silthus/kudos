import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const rewardsModule = "/convex/progression/rewards.ts";

test("P87: reward records are only ever inserted, never changed or deleted", () => {
  const touchingRewards = Object.entries(sources)
    .filter(([, source]) => /["']rewardRecords["']/.test(source))
    .map(([path]) => path);
  const rewardsSource = sources[rewardsModule] ?? "";

  expect(touchingRewards).toEqual([rewardsModule]);
  expect(rewardsSource).toContain('ctx.db.insert("rewardRecords"');
  expect(rewardsSource).not.toMatch(/\.(patch|replace|delete)\(/);
});
