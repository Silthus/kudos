import { expect, test } from "vitest";
import { siteUrl } from "@/lib/viewer";
import { TEST_ENV } from "./env";

// A clean clone has no `.env.local` until `convex dev` writes one, and a developer's `.env.local`
// points at whatever backend they last ran. Either way, tests must see the same pinned URLs.
test("tests see the pinned Convex URLs, never a developer's .env.local", () => {
  expect(import.meta.env.VITE_CONVEX_URL).toBe(TEST_ENV.VITE_CONVEX_URL);
  expect(import.meta.env.VITE_CONVEX_SITE_URL).toBe(TEST_ENV.VITE_CONVEX_SITE_URL);
  expect(siteUrl()).toBe(TEST_ENV.VITE_CONVEX_SITE_URL);
});
