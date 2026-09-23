import { describe, expect, test } from "vitest";
import { nudgeLabels } from "../src/lib/labels";

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
