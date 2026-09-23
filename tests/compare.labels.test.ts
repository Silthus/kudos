import { describe, expect, test } from "vitest";
import { labelWidth, nudgeLabels } from "../src/lib/labels";

// At 11px, Geist averages ~6.4px per character: "Last quarter 1,234" renders ~115px wide, "You 3" ~30px.
describe("labelWidth", () => {
  test("reserves room for the marker gap plus the text", () => {
    expect(labelWidth("Last quarter 1,234")).toBeGreaterThanOrEqual(115);
    expect(labelWidth("Last quarter 1,234")).toBeLessThanOrEqual(140);
    expect(labelWidth("You 3")).toBeLessThanOrEqual(50);
  });
});

// Race-chart endpoint labels ("You 23", "Last month 19") sit beside each line's last point and must not
// collide when the two lines end close together.
describe("nudgeLabels", () => {
  test("labels far apart keep their positions", () => {
    expect(nudgeLabels([{ x: 100, y: 40 }, { x: 100, y: 120 }], { gap: 12, width: 60 })).toEqual([40, 120]);
  });

  test("labels ending within the gap are pushed apart around their middle", () => {
    expect(nudgeLabels([{ x: 300, y: 50 }, { x: 300, y: 54 }], { gap: 12, width: 60 })).toEqual([46, 58]);
  });

  test("the input order is kept even when the lower label comes first", () => {
    expect(nudgeLabels([{ x: 300, y: 54 }, { x: 300, y: 50 }], { gap: 12, width: 60 })).toEqual([58, 46]);
  });

  test("labels that don't overlap sideways stay put even at the same height", () => {
    expect(nudgeLabels([{ x: 100, y: 50 }, { x: 300, y: 50 }], { gap: 12, width: 60 })).toEqual([50, 50]);
  });
});
