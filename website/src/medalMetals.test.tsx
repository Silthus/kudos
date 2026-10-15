import { describe, expect, it } from "vitest";
import { contrast, themeTokenOf, type Mode } from "./test/themeContrast";

const tiers = ["bronze", "silver", "gold", "diamond"] as const;

const modes: Mode[] = ["light", "dark"];

function metalIn(mode: Mode, tier: string) {
  const metal = themeTokenOf(mode, `medal-${tier}`);
  if (!/^#[0-9a-f]{6}$/.test(metal)) throw new Error(`--medal-${tier} is not defined as a hex colour in ${mode}`);
  return `medal-${tier}`;
}

describe("WS94 V24: each medal metal is a token with 3:1 against its card", () => {
  for (const mode of modes) {
    it.each(tiers)(`%s in ${mode}`, (tier) => {
      expect(contrast(mode, metalIn(mode, tier), "card")).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("WS343 WS339: each medal metal holds 3:1 against the public card's muted end", () => {
  for (const mode of modes) {
    it.each(tiers)(`%s in ${mode}`, (tier) => {
      expect(contrast(mode, metalIn(mode, tier), "muted")).toBeGreaterThanOrEqual(3);
    });
  }
});
