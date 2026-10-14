import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Mode = "light" | "dark";

const websiteDirectory = join(__dirname, "..", "..");
const stylesheets = [
  readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "tokens.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "index.css"), "utf8"),
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

function luminanceOfOklch(colour: string) {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(colour);
  if (match === null) throw new Error(`${colour} is not an oklch colour`);
  const [lightness, chroma, hue] = match.slice(1).map(Number) as [number, number, number];
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrast(mode: Mode, paint: string, surface: string) {
  const tokens = declarationsIn(mode);
  const [one, two] = [paint, surface].map((name) => luminanceOfOklch(resolve(tokens, name))) as [number, number];
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}
