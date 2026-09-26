// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useReducedMotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { MOTION_KEY, MotionProvider, reducedMotionFor, storedMotion, useMotion } from "./motion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the Motion setting", () => {
  test("maps onto MotionConfig: on never reduces, reduced always does, unset follows the system", () => {
    expect(reducedMotionFor("on")).toBe("never");
    expect(reducedMotionFor("reduced")).toBe("always");
    expect(reducedMotionFor(null)).toBe("user");
  });

  test("reads only what it wrote from storage", () => {
    localStorage.setItem(MOTION_KEY, "reduced");
    expect(storedMotion()).toBe("reduced");
    localStorage.setItem(MOTION_KEY, "on");
    expect(storedMotion()).toBe("on");
    localStorage.setItem(MOTION_KEY, "sideways");
    expect(storedMotion()).toBeNull();
    localStorage.removeItem(MOTION_KEY);
    expect(storedMotion()).toBeNull();
  });
});

let root: Root;
let host: HTMLElement;
let still: boolean | null = null;
let set: ((m: "on" | "reduced") => void) | null = null;
function Probe() {
  still = useReducedMotionConfig();
  set = useMotion().set;
  return null;
}
beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete document.documentElement.dataset.motion;
});
const render = () =>
  act(() =>
    root.render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    ),
  );

describe("the Motion switch across the app", () => {
  test("reduced stills every motion component, persists, and marks the page for CSS", () => {
    render();
    expect(still).toBe(false);
    act(() => set!("reduced"));
    expect(still).toBe(true);
    expect(localStorage.getItem(MOTION_KEY)).toBe("reduced");
    expect(document.documentElement.dataset.motion).toBe("reduced");
  });

  test("a stored choice holds on the next visit", () => {
    localStorage.setItem(MOTION_KEY, "reduced");
    render();
    expect(still).toBe(true);
    act(() => set!("on"));
    expect(still).toBe(false);
    expect(localStorage.getItem(MOTION_KEY)).toBe("on");
    expect(document.documentElement.dataset.motion).toBe("on");
  });
});

describe("every reduced-motion read follows the switch", () => {
  test("components ask MotionConfig (useReducedMotionConfig), not the system; only the switch itself reads the system", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = join(__dirname, "..");
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    const offenders = files.filter((f) => /useReducedMotion\(\)/.test(readFileSync(join(src, f), "utf8")) && !f.endsWith(join("world", "Hud.tsx")));
    expect(offenders).toEqual([]);
  });

  test("CSS follows it too: reduced stills every transition (motion-safe ones included); on keeps the meter's step", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(__dirname, "..", "index.css"), "utf8").replace(/\s+/g, " ");
    expect(css).toMatch(/:root\[data-motion="reduced"\] \*, :root\[data-motion="reduced"\] \*::before, :root\[data-motion="reduced"\] \*::after \{ transition: none !important; \}/);
    // The system's reduce stills the meter unless the switch says on.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ :root:not\(\[data-motion="on"\]\) & > \[data-fill\]/);
  });
});
