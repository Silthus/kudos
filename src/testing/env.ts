/**
 * The `VITE_*` env every test runs with (set in `vitest.config.ts`, which also stops Vitest from
 * reading `.env*` files). `.invalid` hosts can never resolve, so nothing under test reaches a backend.
 */
export const TEST_ENV = {
  VITE_CONVEX_URL: "https://convex.kudos-tests.invalid",
  VITE_CONVEX_SITE_URL: "https://site.kudos-tests.invalid",
};
