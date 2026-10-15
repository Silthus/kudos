import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const websiteDirectory = join(__dirname, "..");
const siteCss = readFileSync(join(websiteDirectory, "src", "index.css"), "utf8");
const sitePackage = JSON.parse(readFileSync(join(websiteDirectory, "package.json"), "utf8")) as { dependencies: Record<string, string> };

const brandFaces = [
  { weight: 400, file: "RoundHog.woff2" },
  { weight: 500, file: "RoundHog-Medium.woff2" },
  { weight: 700, file: "RoundHog-SemiBold.woff2" },
  { weight: 800, file: "RoundHog-Bold.woff2" },
];

function fontFaces() {
  return [...siteCss.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => ({
    weight: Number(/font-weight: (\d+);/.exec(body!)?.[1]),
    file: /url\("@posthog\/brand\/fonts\/([\w-]+\.woff2)"\)/.exec(body!)?.[1],
  }));
}

function ruleOf(selector: string) {
  const escaped = selector.replace(/[.]/g, "\\$&");
  const rule = new RegExp(`^${escaped} \\{([^}]*)\\}`, "m").exec(siteCss)?.[1];
  if (rule === undefined) throw new Error(`${selector} has no rule of its own in index.css`);
  return rule;
}

describe("#453: RoundHog is the site's typeface at the brand's four weights", () => {
  it("registers the brand's upright faces from @posthog/brand at 400, 500, 700 and 800, and nothing else", () => {
    expect(fontFaces()).toEqual(brandFaces);
  });

  it("makes RoundHog the sans typeface of every word, with no Inter anywhere", () => {
    expect(ruleOf(":root")).toMatch(/--font-sans: RoundHog,/);
    expect(siteCss).not.toMatch(/Inter/);
    expect(sitePackage.dependencies).not.toHaveProperty("@fontsource-variable/inter");
  });

  it("tracks display type at posthog.com's −0.025em and sets its labels in the same face", () => {
    expect(ruleOf(".hud-display")).toMatch(/letter-spacing: -0\.025em;/);
    expect(ruleOf(".hud-label")).toMatch(/font-size: 11px;/);
    expect(ruleOf(".hud-label")).toMatch(/font-weight: 700;/);
    expect(ruleOf(".hud-label")).toMatch(/letter-spacing: 0\.08em;/);
  });
});
