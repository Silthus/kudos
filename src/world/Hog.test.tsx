// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));
const { Hog } = await import("./Hog");
type Handle = import("./Hog").HogHandle;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (still: boolean, accessory?: string) => {
  const ref = createRef<Handle>();
  act(() => root.render(<Hog ref={ref} still={still} accessory={accessory} />));
  return { hog: ref.current!, canvas: host.querySelector<HTMLCanvasElement>("canvas[data-hog]")! };
};

test("says what it plays and wears", () => {
  const { hog, canvas } = render(false, "party");
  expect(canvas.dataset.animation).toBe("idle");
  expect(canvas.dataset.accessory).toBe("party");
  hog.play("jump", { loop: false, then: "idle" });
  expect(canvas.dataset.animation).toBe("jump");
});

test("under reduced motion every animation is the still idle frame", () => {
  const { hog, canvas } = render(true);
  hog.play("wave", { loop: false, then: "idle" });
  expect(canvas.dataset.animation).toBe("idle");
});

test("holding up its sign it faces you, so the sign never reads backwards", () => {
  const { hog, canvas } = render(false);
  hog.face(true);
  expect(canvas.style.transform).toBe("scaleX(-1)");
  hog.play("sign", { loop: false, then: "idle" });
  expect(canvas.style.transform).toBe("");
});
