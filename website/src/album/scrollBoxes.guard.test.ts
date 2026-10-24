// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("#708: the sidebar stays in view", () => {
  it("no scroll box lets the hidden text it scrolls stretch the page past the album, so the sidebar never runs out of room to stick", () => {
    const albumCss = readdirSync(__dirname)
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFileSync(join(__dirname, file), "utf8"))
      .join("\n");

    expect(atRulesIn(albumCss).filter((atRule) => !readAtRules.includes(atRule))).toEqual([]);
    expect(looseScrollBoxesIn(albumCss)).toEqual([]);
  });

  it("reads the stylesheets as a desktop browser does: the last position wins, a condition can only take a position away, rules only below 64rem are left out with the phone drawer, every at-rule is read, and each selector of a list counts", () => {
    const css = [
      ".a, .b { overflow: hidden auto }",
      ".a { position: relative }",
      ".b { position: sticky }",
      ".b { position: static }",
      "@media (min-width: 64rem) { .c { overflow-x: scroll; position: absolute } }",
      "@supports (display: grid) { .c { position: static } }",
      ".d { overflow: auto; position: static }",
      "@media (prefers-reduced-motion: reduce) { .d { position: relative } }",
      ".e { overflow-y: auto; position: relative }",
      "@media (prefers-reduced-motion: reduce) { .e { position: static } }",
      "@media (max-width: 63.999rem) { @keyframes fade { from { opacity: 0 } } .a { position: static } .f { overflow: auto } }",
      ".g, .h, .i { overflow: auto; position: relative }",
      "@media (min-width: 64rem) and (prefers-reduced-motion: reduce) { .g { position: static } }",
      "@media (max-width: 63.999rem), (min-width: 90rem) { .h { position: static } }",
      "@media (max-width: 47.99rem) { .i { position: static } }",
      ".j { overflow: auto; position: relative }",
      "@container (max-width: 13rem) { .j { position: static } }",
    ].join("\n");

    expect(looseScrollBoxesIn(css)).toEqual([".b", ".c", ".d", ".e", ".g", ".h", ".j"]);
    expect(atRulesIn(`${css}\n@layer later { .a { position: static } }\n/* @scope */`)).toEqual(["@media", "@supports", "@keyframes", "@container", "@layer"]);
  });
});

type DesktopRule = { selectors: string[]; style: CSSStyleDeclaration; conditional: boolean };

const everyDesktopWidth = "(min-width: 64rem)";
const readAtRules = ["@media", "@supports", "@container", "@keyframes"];

function atRulesIn(css: string) {
  return [...new Set(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/@[\w-]+/g) ?? [])];
}

function looseScrollBoxesIn(css: string) {
  const rules = desktopRulesOf(css);
  const scrollBoxes = rules.filter(scrolls).flatMap(({ selectors }) => selectors);
  return [...new Set(scrollBoxes)].filter((selector) => !holdsWhatItScrolls(selector, rules));
}

function desktopRulesOf(css: string): DesktopRule[] {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    return rulesWithin(style.sheet!.cssRules, false);
  } finally {
    style.remove();
  }
}

function rulesWithin(rules: CSSRuleList, conditional: boolean): DesktopRule[] {
  return [...rules].flatMap((rule) => {
    if (rule instanceof CSSStyleRule) return [{ selectors: rule.selectorText.split(",").map((selector) => selector.trim()), style: rule.style, conditional }];
    if (rule instanceof CSSMediaRule) return onlyBelowDesktop(rule.media.mediaText) ? [] : rulesWithin(rule.cssRules, conditional || rule.media.mediaText !== everyDesktopWidth);
    if (rule instanceof CSSSupportsRule) return rulesWithin(rule.cssRules, conditional);
    if (rule instanceof CSSContainerRule) return rulesWithin(rule.cssRules, true);
    return [];
  });
}

function onlyBelowDesktop(mediaText: string) {
  const widest = /^\(max-width: ([\d.]+)rem\)$/.exec(mediaText)?.[1];
  return widest !== undefined && Number(widest) < 64;
}

function scrolls({ style }: DesktopRule) {
  return ["overflow", "overflow-x", "overflow-y"].some((property) => /\b(auto|scroll)\b/.test(style.getPropertyValue(property)));
}

function holdsWhatItScrolls(selector: string, rules: DesktopRule[]) {
  const positions = rules.filter(({ selectors, style }) => selectors.includes(selector) && style.position !== "");
  const always = positions.findLast(({ conditional }) => !conditional)?.style.position ?? "static";
  return always !== "static" && !positions.some(({ conditional, style }) => conditional && style.position === "static");
}
