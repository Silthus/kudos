import { describe, expect, it } from "vitest";
import { parseThemePref, resolveTheme } from "../src/lib/theme";

describe("resolveTheme", () => {
  it("follows the system when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("an explicit choice wins over the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("parseThemePref", () => {
  it("reads a stored light or dark choice", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
  });

  it("falls back to system for nothing stored or anything unknown", () => {
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("Dark")).toBe("system");
    expect(parseThemePref("sepia")).toBe("system");
  });
});
