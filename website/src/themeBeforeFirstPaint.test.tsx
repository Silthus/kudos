import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const websiteDirectory = join(__dirname, "..");
const publicDirectory = join(websiteDirectory, "public");
const indexHtml = new DOMParser().parseFromString(readFileSync(join(websiteDirectory, "index.html"), "utf8"), "text/html");

function headScript() {
  const first = indexHtml.head.querySelector("script, link[rel=stylesheet]");
  if (!(first instanceof HTMLScriptElement)) throw new Error("the page's head starts with no script");
  return first;
}

function scriptSource() {
  const fileName = headScript().getAttribute("src")?.replace(/^\//, "") ?? "";
  return { fileName, source: readFileSync(join(publicDirectory, fileName), "utf8") };
}

function themeBeforeReact({ stored, systemDark }: { stored?: string; systemDark: boolean }) {
  fakeSystemTheme(systemDark);
  if (stored) localStorage.setItem("hedgehug.theme", stored);
  new Function(scriptSource().source)();
  return document.documentElement.classList.contains("dark");
}

function themeReactSettlesOn({ stored, systemDark }: { stored?: string; systemDark: boolean }) {
  fakeSystemTheme(systemDark);
  if (stored) localStorage.setItem("hedgehug.theme", stored);
  const { unmount } = renderApp(shellFixtures.signedOut);
  const dark = document.documentElement.classList.contains("dark");
  unmount();
  document.documentElement.classList.remove("dark");
  localStorage.clear();
  return dark;
}

describe("V6: the page paints in the member's theme from the first frame", () => {
  it("the head runs one blocking script before any stylesheet or module, so it runs before the first paint", () => {
    const script = headScript();

    expect(["type", "async", "defer"].filter((attribute) => script.hasAttribute(attribute))).toEqual([]);
    expect(script.getAttribute("src")).toMatch(/^\/theme-[0-9a-f]{8}\.js$/);
  });

  it("the script's file is named after its content, since the edge caches a public file for a year", () => {
    const { fileName, source } = scriptSource();
    const contentHash = createHash("sha256").update(source).digest("hex").slice(0, 8);

    expect(fileName).toBe(`theme-${contentHash}.js`);
    expect(readdirSync(publicDirectory).filter((file) => file.startsWith("theme-"))).toEqual([fileName]);
  });

  it.each([
    { case: "a first visit on a dark system", stored: undefined, systemDark: true },
    { case: "a first visit on a light system", stored: undefined, systemDark: false },
    { case: "dark chosen on a light system", stored: "dark", systemDark: false },
    { case: "light chosen on a dark system", stored: "light", systemDark: true },
    { case: "an unknown stored choice on a dark system", stored: "sepia", systemDark: true },
  ])("for $case, the script sets the same theme the theme control settles on", ({ stored, systemDark }) => {
    const settled = themeReactSettlesOn({ stored, systemDark });

    expect(themeBeforeReact({ stored, systemDark })).toBe(settled);
  });

  it("a browser that refuses storage still gets the system's theme", () => {
    fakeSystemTheme(true);
    const refusing = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage is disabled", "SecurityError");
      },
    });
    try {
      new Function(scriptSource().source)();
    } finally {
      if (refusing) Object.defineProperty(window, "localStorage", refusing);
    }

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
