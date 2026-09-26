import { describe, expect, test } from "vitest";
import { hogFilter } from "./look";

describe("a hog's colour, as Hedgehog Mode tints it", () => {
  test("no colour is no filter", () => {
    expect(hogFilter(null, 0, false)).toBe("");
  });

  test("each colour is Hedgehog Mode's own colour matrix, as CSS filters", () => {
    expect(hogFilter("red", 0, false)).toBe("hue-rotate(350deg) saturate(1.2) brightness(0.9)");
    expect(hogFilter("green", 0, false)).toBe("hue-rotate(60deg)");
    expect(hogFilter("blue", 0, false)).toBe("hue-rotate(210deg) saturate(3) brightness(0.9)");
    expect(hogFilter("purple", 0, false)).toBe("hue-rotate(240deg)");
    expect(hogFilter("dark", 0, false)).toBe("brightness(0.7)");
    expect(hogFilter("light", 0, false)).toBe("brightness(1.3)");
    expect(hogFilter("greyscale", 0, false)).toBe("grayscale(1)");
    expect(hogFilter("sepia", 0, false)).toBe("sepia(1)");
    expect(hogFilter("invert", 0, false)).toBe("invert(1)");
  });

  test("rainbow goes round the colour wheel once a second; under reduced motion it holds one hue", () => {
    expect(hogFilter("rainbow", 0, false)).toBe("hue-rotate(0deg)");
    expect(hogFilter("rainbow", 250, false)).toBe("hue-rotate(90deg)");
    expect(hogFilter("rainbow", 1250, false)).toBe("hue-rotate(90deg)");
    expect(hogFilter("rainbow", 250, true)).toBe("hue-rotate(180deg)");
  });
});
