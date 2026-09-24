/**
 * The game's PostHog art (#101, #55 §G17), in one place: the Keyboard garden, the hoggies and Max
 * on the Hog coin. PostHog allows the art (the app is internal to PostHog), but while this repo is
 * public nothing PostHog-drawn is committed: every image loads from PostHog's own servers at
 * runtime, and `tests/noPosthogArt.test.ts` fails if one ever lands in git. After the move into
 * PostHog's repo these files get vendored and only this registry changes.
 *
 * Every URL is pinned, so the art can't change under us: Cloudinary ids are content-hashed, and the
 * hoggies come from an exact `@posthog/brand` version on jsDelivr (immutable, CORS open). Each
 * entry carries its size so its box is reserved before it loads (no layout shift).
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
  /** Profile banner: a band through the Keyboard garden where a hedgehog waters the S bed. */
  "banner-keyboard-garden": cloudinary(KEYBOARD_GARDEN, "c_crop,x_250,y_420,w_1100,h_275/f_auto,q_auto,w_960", 960, 240),
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
