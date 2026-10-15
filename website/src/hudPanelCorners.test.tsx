import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const siteCss = readFileSync(join(__dirname, "index.css"), "utf8");

function ruleOf(selector: string) {
  const escaped = selector.replace(/[.:]/g, "\\$&");
  const rule = new RegExp(`^ *${escaped} \\{([^}]*)\\}`, "m").exec(siteCss)?.[1];
  if (rule === undefined) throw new Error(`${selector} has no rule of its own in index.css`);
  return rule;
}

function layerOf(selector: string) {
  const escaped = selector.replace(/[.:]/g, "\\$&");
  const before = siteCss.slice(0, new RegExp(`^ *${escaped} \\{`, "m").exec(siteCss)?.index);
  return /@layer (\w+) \{[^{}]*$/.exec(before)?.[1];
}

describe("#453 V2: corner marks stay on the panel they frame", () => {
  it("declares hud-panel positioned in the components layer, so a positioning utility such as lg:sticky still wins", () => {
    expect(ruleOf(".hud-panel")).toMatch(/position: relative;/);
    expect(layerOf(".hud-panel")).toBe("components");
  });

  it("declares the marks above the panel's in-flow children, so an opaque band never covers one", () => {
    expect(ruleOf(".hud-panel::before,\n.hud-panel::after")).toMatch(/z-index: 1;/);
  });

});
