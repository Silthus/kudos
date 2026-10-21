import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Mode = "light" | "dark";

type Rgb = [number, number, number];

export const websiteDirectory = join(__dirname, "..", "..");
const stylesheets = [
  readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "tokens.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "index.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "album", "album.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "album", "opening.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "album", "team.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "album", "hoggies.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "album", "xpMoment.css"), "utf8"),
];

function declarationsIn(mode: Mode) {
  const tokens = new Map<string, string>();
  const cascade: Mode[] = mode === "dark" ? ["light", "dark"] : ["light"];
  for (const layer of cascade) {
    for (const css of stylesheets) {
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (selector!.includes("@theme") || selector!.includes(".dark") !== (layer === "dark")) continue;
        for (const [, name, value] of body!.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens.set(name!, value!.trim());
      }
    }
  }
  return tokens;
}

function resolve(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`--${name} is not a theme token`);
  return value
    .replace(/var\(--([\w-]+)\)/g, (_, inner: string) => resolve(tokens, inner))
    .replace(/calc\(([\d.]+) \* ([\d.]+)\)/g, (_, a: string, b: string) => String(Number(a) * Number(b)));
}

function linearRgbOfOklch(colour: string): Rgb {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(colour);
  if (match === null) throw new Error(`${colour} is not an oklch colour`);
  const [lightness, chroma, hue] = match.slice(1).map(Number) as Rgb;
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const encoded = (channel: number) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);

const decoded = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

function linearRgbOf(colour: string): Rgb {
  return colour.startsWith("#") ? linearRgbOfHex(colour) : linearRgbOfOklch(colour);
}

function linearRgbOfHex(hex: string): Rgb {
  return [1, 3, 5].map((at) => decoded(parseInt(hex.slice(at, at + 2), 16) / 255)) as Rgb;
}

function over(paint: Rgb, opacity: number, backdrop: Rgb): Rgb {
  return paint.map((channel, i) => decoded(opacity * encoded(channel) + (1 - opacity) * encoded(backdrop[i]!))) as Rgb;
}

function luminanceOf([red, green, blue]: Rgb) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function ratio(one: number, two: number) {
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

export function themeTokenOf(mode: Mode, name: string) {
  return resolve(declarationsIn(mode), name);
}

export function contrast(mode: Mode, paint: string, surface: string) {
  const tokens = declarationsIn(mode);
  const [one, two] = [paint, surface].map((name) => luminanceOf(linearRgbOf(resolve(tokens, name)))) as [number, number];
  return ratio(one, two);
}

export function contrastAtOpacity(mode: Mode, paint: string, surface: string, { opacity, backdrop }: { opacity: number; backdrop: string }) {
  const tokens = declarationsIn(mode);
  const [ink, ground, behind] = [paint, surface, backdrop].map((name) => linearRgbOf(resolve(tokens, name))) as [Rgb, Rgb, Rgb];
  return ratio(luminanceOf(over(ink, opacity, behind)), luminanceOf(over(ground, opacity, behind)));
}

export function contrastUnderScrim(mode: Mode, paint: string, surface: string, { scrim }: { scrim: string }) {
  const tokens = declarationsIn(mode);
  const { colour, opacity } = translucentOf(resolve(tokens, scrim));
  const [ink, ground] = [paint, surface].map((name) => over(colour, opacity, linearRgbOf(resolve(tokens, name)))) as [Rgb, Rgb];
  return ratio(luminanceOf(ink), luminanceOf(ground));
}

function translucentOf(value: string) {
  const match = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(value);
  if (match === null) throw new Error(`${value} is not a translucent rgb colour`);
  const [red, green, blue, opacity] = match.slice(1).map(Number) as [number, number, number, number];
  return { colour: [red, green, blue].map((channel) => decoded(channel / 255)) as Rgb, opacity };
}

export function contrastOnTint(mode: Mode, paint: string, tint: string, { backdrop }: { backdrop: string }) {
  const tokens = declarationsIn(mode);
  const mix = /^color-mix\(in oklab, (.+) ([\d.]+)%, transparent\)$/.exec(resolve(tokens, tint));
  if (mix === null) throw new Error(`--${tint} is not a tint over transparent`);
  const behind = linearRgbOf(resolve(tokens, backdrop));
  const ground = over(linearRgbOf(mix[1]!), Number(mix[2]) / 100, behind);
  return ratio(luminanceOf(linearRgbOf(resolve(tokens, paint))), luminanceOf(ground));
}
