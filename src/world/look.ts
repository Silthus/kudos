import type { Look } from "../../convex/lib/presence";

/**
 * A hog's look (#155 `setLook`, #158): Hedgehog Mode's colour options and accessories, as the
 * world draws them and the cabin names them. The option lists themselves are the backend's
 * (`convex/lib/presence.ts` `HOG_COLORS`, `HOG_ACCESSORIES`).
 */

export type HogColor = NonNullable<Look["color"]>;
export type HogAccessory = NonNullable<Look["accessory"]>;

/**
 * Hedgehog Mode's colours (`COLOR_TO_FILTER_MAP`, a Pixi colour matrix on the hedgehog's sprite,
 * never its accessory) as the same steps in CSS filters. Rainbow is animated: the hue goes round
 * once a second, as in Hedgehog Mode; under reduced motion it holds one hue.
 */
const COLOR_FILTERS: Record<Exclude<HogColor, "rainbow">, string> = {
  red: "hue-rotate(350deg) saturate(1.2) brightness(0.9)",
  green: "hue-rotate(60deg)",
  blue: "hue-rotate(210deg) saturate(3) brightness(0.9)",
  purple: "hue-rotate(240deg)",
  dark: "brightness(0.7)",
  light: "brightness(1.3)",
  greyscale: "grayscale(1)",
  sepia: "sepia(1)",
  invert: "invert(1)",
};

/** The CSS filter for a hog's colour, `elapsedMs` into its life (for rainbow). */
export function hogFilter(color: Look["color"], elapsedMs: number, still: boolean): string {
  if (!color) return "";
  if (color !== "rainbow") return COLOR_FILTERS[color];
  return `hue-rotate(${still ? 180 : Math.floor(((Math.max(0, elapsedMs) % 1000) * 360) / 1000)}deg)`;
}

/** What the cabin calls each colour. */
export const COLOR_NAMES: Record<HogColor, string> = {
  green: "Green",
  red: "Red",
  blue: "Blue",
  purple: "Purple",
  dark: "Dark",
  light: "Light",
  greyscale: "Greyscale",
  sepia: "Sepia",
  invert: "Inverted",
  rainbow: "Rainbow",
};

/** What the cabin calls each accessory. */
export const ACCESSORY_NAMES: Record<HogAccessory, string> = {
  beret: "Beret",
  cap: "Cap",
  chef: "Chef's hat",
  cowboy: "Cowboy hat",
  eyepatch: "Eyepatch",
  flag: "Flag",
  glasses: "Glasses",
  graduation: "Graduation cap",
  parrot: "Parrot",
  party: "Party hat",
  pineapple: "Pineapple",
  sunglasses: "Sunglasses",
  tophat: "Top hat",
  "xmas-hat": "Christmas hat",
  "xmas-antlers": "Antlers",
  "xmas-scarf": "Christmas scarf",
};
