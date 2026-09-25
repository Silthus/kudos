/**
 * The game's PostHog art (#101, #55 §G17), in one place: the Keyboard garden, the hoggies and Max
 * on the Hog coin. PostHog allows the art (the app is internal to PostHog), but while this repo is
 * public nothing PostHog-drawn is committed: every image loads from PostHog's own servers at
 * runtime, and `tests/noPosthogArt.test.ts` fails if one ever lands in git. After the move into
 * PostHog's repo these files get vendored and only this registry changes.
 *
 * Every URL is pinned as far as its host allows: the hoggies come from an exact `@posthog/brand`
 * version on jsDelivr (immutable, CORS open; full 1000 px PNGs of ~45 KB, as jsDelivr can't resize).
 * Cloudinary ids carry an upload hash, so a re-upload gets a new id rather than changing ours; the
 * crops and AVIF/WebP sizing rely on PostHog's Cloudinary allowing on-the-fly transformations. If
 * either host fails, each slot's placeholder stays (`RemoteArt`). Each entry carries its size so
 * its box is reserved before it loads (no layout shift).
 *
 * Screenshots of the app now show this art: don't commit new ones (e.g. `docs/screenshots`) while
 * the repo is public.
 *
 * A slot missing here has no PostHog art (a Starfield banner, the emoji swatches): it keeps its
 * own look, the same placeholder that stands in whenever a remote image fails to load.
 */

export type RemoteImage = { src: string; width: number; height: number };

/** The `@posthog/brand` release the hoggies are pinned to. */
export const BRAND_VERSION = "0.12.3";

const CLOUDINARY = "https://res.cloudinary.com/dmukukwp6/image/upload";

/** A hoggie from the brand package: 1000 × 1000 transparent PNGs. */
const hoggie = (name: string): RemoteImage => ({
  src: `https://cdn.jsdelivr.net/npm/@posthog/brand@${BRAND_VERSION}/dist/generated/hoggies/png/${name}.png`,
  width: 1000,
  height: 1000,
});

/** An image on posthog.com's Cloudinary, cropped or scaled there and served as AVIF/WebP where the browser takes it. */
const cloudinary = (id: string, transform: string, width: number, height: number): RemoteImage => ({
  src: `${CLOUDINARY}/${transform}/${id}`,
  width,
  height,
});

/** posthog.com's Keyboard garden wallpaper (1401 × 1400), in its evening colours to suit the app's dark theme. */
const KEYBOARD_GARDEN = "keyboard_garden_dark_opt_15e213413c.png";

export const ART = {
  /** The whole Keyboard garden: key beds and gardening hedgehogs, at the top of your garden. */
  "garden-scene": cloudinary(KEYBOARD_GARDEN, "f_auto,q_auto,w_720", 720, 720),
  /** Max's face, cropped from posthog.com's Max portrait, on the face of every Hog coin. */
  "coin-max": cloudinary("ai_max_e80de99727.png", "c_crop,x_130,y_180,w_420,h_420/f_auto,q_auto,w_96", 96, 96),
  /** Profile banner: a band of key beds (H, S and T) through the Keyboard garden, filled edge to edge. */
  "banner-keyboard-garden": cloudinary(KEYBOARD_GARDEN, "c_crop,x_200,y_600,w_1000,h_250/f_auto,q_auto,w_960", 960, 240),
  /** Frame: the leafy top of the garden's P hedge, so the ring around your picture is hedge. */
  "frame-meadow": cloudinary(KEYBOARD_GARDEN, "c_crop,x_120,y_230,w_320,h_320/f_auto,q_auto,w_160", 160, 160),
  "hoggie-gardener": hoggie("gardener-1"),
  "hoggie-reader": hoggie("reading"),
  "hoggie-party": hoggie("party"),
  /** The gardener waiting by an empty plot. */
  "hoggie-empty-plot": hoggie("gardener-2"),
  /** A level-up DM (#99) on the web. */
  "hoggie-level-up": hoggie("level-up"),
  /** The receiver's Super kudos celebration (#98). */
  "super-kudos-celebration": hoggie("heart"),
} satisfies Record<string, RemoteImage>;

/** The PostHog art for a slot, or null when it has none (its placeholder stays). */
export function artFor(slot: string): RemoteImage | null {
  return Object.hasOwn(ART, slot) ? ART[slot as keyof typeof ART] : null;
}

/** The `@posthog/hedgehog-mode` release the world's hedgehog is pinned to (MIT, #128). */
export const HEDGEHOG_MODE_VERSION = "0.0.58";
const HEDGEHOG_ASSETS = `https://cdn.jsdelivr.net/npm/@posthog/hedgehog-mode@${HEDGEHOG_MODE_VERSION}/assets`;

/**
 * Hedgehog Mode's sprite atlas: the player in the world is PostHog's own hedgehog (never one we
 * drew). A TexturePacker sheet of 80 × 80 frames (`sprites.json`) over one 2000 × 1440 PNG, which
 * `src/world/atlas.ts` loads after first paint and draws frame by frame (not the package's Pixi
 * renderer).
 */
export const HEDGEHOG_MODE = {
  json: `${HEDGEHOG_ASSETS}/sprites.json`,
  png: { src: `${HEDGEHOG_ASSETS}/sprites.png`, width: 2000, height: 1440 } satisfies RemoteImage,
  credit: "Hedgehog Mode by PostHog (MIT)",
};
