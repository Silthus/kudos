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
