import { expect, test } from "vitest";
import { COSMETICS } from "../../convex/lib/cosmetics";
import { ART, artFor } from "./art";

/**
 * The art registry (#101, #55 §G17): every piece of PostHog art the game shows, loaded from
 * PostHog's servers at runtime (never committed while the repo is public), pinned so it can't
 * change under us, and sized so it never shifts the layout while it loads.
 */

test("hoggie stickers come from the pinned @posthog/brand package on jsDelivr", () => {
  expect(artFor("hoggie-gardener")?.src).toBe("https://cdn.jsdelivr.net/npm/@posthog/brand@0.12.3/dist/generated/hoggies/png/gardener-1.png");
  expect(artFor("hoggie-reader")?.src).toBe("https://cdn.jsdelivr.net/npm/@posthog/brand@0.12.3/dist/generated/hoggies/png/reading.png");
  expect(artFor("hoggie-party")?.src).toBe("https://cdn.jsdelivr.net/npm/@posthog/brand@0.12.3/dist/generated/hoggies/png/party.png");
});

test("the Keyboard garden and Max come from PostHog's Cloudinary, sized down and auto-formatted", () => {
  const garden = artFor("garden-scene")!;
  expect(garden.src).toMatch(/^https:\/\/res\.cloudinary\.com\/dmukukwp6\/image\/upload\/f_auto,q_auto,w_\d+\/keyboard_garden_dark_opt_15e213413c\.png$/);
  expect(artFor("coin-max")?.src).toContain("/ai_max_e80de99727.png");
});

test("a slot without PostHog art has no URL, so its placeholder stays", () => {
  expect(artFor("banner-starfield")).toBeNull();
  expect(artFor("emoji-golden")).toBeNull();
  expect(artFor("no-such-slot")).toBeNull();
});

test("every hoggie sticker and the Keyboard garden banner in the Store has art", () => {
  const needArt = COSMETICS.filter((c) => c.slot === "sticker" || c.key === "bannerKeyboardGarden" || c.key === "frameMeadow");
  expect(needArt.length).toBe(5);
  for (const c of needArt) expect(artFor(c.art.slot), c.art.slot).not.toBeNull();
});

test("every URL is https on PostHog's servers, pinned: a content-hashed Cloudinary id or an exact package version", () => {
  for (const [slot, art] of Object.entries(ART)) {
    const ok =
      /^https:\/\/res\.cloudinary\.com\/dmukukwp6\/image\/upload\/(?:[a-z0-9_,:.]+\/)*[A-Za-z0-9_]+_[0-9a-f]{10}\.(png|jpg)$/.test(art.src) ||
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@posthog\/brand@\d+\.\d+\.\d+\/dist\/generated\/hoggies\/png\/[a-z0-9-]+\.png$/.test(art.src);
    expect(ok, `${slot}: ${art.src}`).toBe(true);
  }
});

test("every entry knows its size, so it reserves its box before it loads", () => {
  for (const [slot, art] of Object.entries(ART)) {
    expect(art.width, slot).toBeGreaterThan(0);
    expect(art.height, slot).toBeGreaterThan(0);
  }
});
