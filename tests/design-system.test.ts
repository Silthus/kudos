// @vitest-environment node
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RarityBadge } from "../src/components/ui";
import { RARITY_ORDER } from "../src/lib/rarity";

// The shell and the primitives are the restyle's foundation (#57): they only speak in semantic tokens.
// Pages still use the temporary v1 aliases until their own pass; R10 widens this guard to src/pages.
const FOUNDATION = ["src/components/ui.tsx", "src/components/AppShell.tsx", "src/components/KudosMark.tsx", "src/components/ErrorBoundary.tsx", "src/lib/theme.ts", "src/lib/rarity.ts"];
const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const V1_ALIAS = "ink|panel(?:-[23])?|line(?:-strong)?|cream|muted|faint|saffron(?:-deep)?|ember|teal(?:-soft)?|up|down|benchmark";
const RULES: [string, RegExp][] = [
  ["raw hex colour", /#[0-9a-fA-F]{3,8}\b/],
  ["v1 alias class", new RegExp(`\\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|shadow|decoration|accent|caret)-(?:${V1_ALIAS})(?![\\w-])`)],
  ["v1 alias variable", new RegExp(`--color-(?:${V1_ALIAS})(?![\\w-])`)],
  ["removed v1 effect (grain, shimmer, glow, blur)", /\b(?:grain|legendary-text|animate-shimmer|animate-float|backdrop-blur[\w-]*|glow)\b/],
];

describe("the foundation speaks only in semantic tokens", () => {
  it.each(FOUNDATION)("%s", (file) => {
    const lines = source(file).split("\n");
    const offences = lines.flatMap((line, i) => RULES.filter(([, re]) => re.test(line)).map(([what]) => `${file}:${i + 1} ${what}: ${line.trim()}`));
    expect(offences).toEqual([]);
  });
});

describe("RarityBadge", () => {
  const badges = RARITY_ORDER.map((rarity) => renderToStaticMarkup(createElement(RarityBadge, { rarity })));

  it("always writes the rarity as a word", () => {
    expect(badges.map((html) => html.replace(/<[^>]+>/g, ""))).toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
  });

  it("gives every tier its own pip shape, so rarity is never colour alone", () => {
    const shapes = badges.map((html) => html.match(/data-pip="([\w-]+)"/)?.[1]);
    expect(shapes).toEqual(["ring", "dot", "diamond", "sparkle", "star"]);
  });
});
