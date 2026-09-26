// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// No atlas in tests: the hedgehog keeps its placeholder.
vi.mock("./atlas", async (real) => ({ ...(await real<typeof import("./atlas")>()), loadAtlas: () => new Promise(() => {}) }));
const { Hog } = await import("./Hog");
type Handle = import("./Hog").HogHandle;
type Look = import("../../convex/lib/presence").Look;
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

const render = (still: boolean, look?: Look) => {
  const ref = createRef<Handle>();
  act(() => root.render(<Hog ref={ref} still={still} look={look} />));
  return { hog: ref.current!, canvas: host.querySelector<HTMLCanvasElement>("canvas[data-hog]")!, worn: host.querySelector<HTMLCanvasElement>("canvas[data-hog-accessory]") };
};

test("says what it plays and wears", () => {
  const { hog, canvas } = render(false, { color: null, accessory: "party" });
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

test("wears its look: the colour tints the hedgehog, never what it wears", () => {
  const { canvas, worn } = render(false, { color: "blue", accessory: "tophat" });
  expect(canvas.dataset.color).toBe("blue");
  expect(canvas.style.filter).toBe("hue-rotate(210deg) saturate(3) brightness(0.9)");
  expect(worn?.dataset.accessory).toBe("tophat");
  expect(worn?.style.filter).toBe("");
});

test("with no look, no tint and nothing worn", () => {
  const { canvas, worn } = render(false);
  expect(canvas.style.filter).toBe("");
  expect(worn).toBeNull();
});

test("put on after turning left, what it wears faces left too (review #6)", () => {
  const ref = createRef<Handle>();
  act(() => root.render(<Hog ref={ref} still={false} look={{ color: null, accessory: null }} />));
  ref.current!.face(true);
  act(() => root.render(<Hog ref={ref} still={false} look={{ color: null, accessory: "cap" }} />));
  expect(host.querySelector<HTMLCanvasElement>("canvas[data-hog-accessory]")!.style.transform).toBe("scaleX(-1)");
});

test("holding up its sign after facing left, it says it faces right, as drawn (review #7)", () => {
  const { hog, canvas } = render(false);
  hog.face(true);
  hog.play("sign", { loop: false, then: "idle" });
  hog.face(true);
  expect(canvas.style.transform).toBe("");
  expect(hog.now().facing).toBe("right");
});

test("turning left, what it wears turns with it", () => {
  const { hog, canvas, worn } = render(false, { color: null, accessory: "cap" });
  hog.face(true);
  expect(canvas.style.transform).toBe("scaleX(-1)");
  expect(worn!.style.transform).toBe("scaleX(-1)");
});
