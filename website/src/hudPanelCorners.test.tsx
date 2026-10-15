import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const siteCss = readFileSync(join(__dirname, "index.css"), "utf8");

function ruleOf(selector: string) {
  const escaped = selector.replace(/[.]/g, "\\$&");
  const rule = new RegExp(`^${escaped} \\{([^}]*)\\}`, "m").exec(siteCss)?.[1];
  if (rule === undefined) throw new Error(`${selector} has no rule of its own in index.css`);
  return rule;
}

describe("#453 V2: corner marks stay on the panel they frame", () => {
  it("positions every hud-panel itself, so its marks never land on the viewport's corner", () => {
    expect(ruleOf(".hud-panel")).toMatch(/position: relative;/);
  });

});
