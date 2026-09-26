// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Camera, type CameraHandle } from "./Camera";

/** The camera in a 1280 × 900 view, as the world shell drives it when a window docks and closes. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEW = { width: 1280, height: 900 };
const DOCKED = 744; // Window.tsx's docked width at 1280, with its frame

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(VIEW.width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(VIEW.height);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const camera = createRef<CameraHandle>();
let views: { x: number; y: number; width: number; height: number }[] = [];
function show(insetRight: number) {
  act(() =>
    root.render(
      <Camera ref={camera} insetRight={insetRight} onTap={() => {}} onView={(v) => views.push(v)}>
        <div />
      </Camera>,
    ),
  );
}
/** Where the camera looks: the view's top-left on the stage, from the stage's transform. */
function looking() {
  const [, x, y] = /translate3d\((-?\d+)px, (-?\d+)px/.exec(host.querySelector<HTMLElement>(".will-change-transform")!.style.transform)!;
  return { x: -Number(x), y: -Number(y) };
}
const settle = () => act(() => vi.advanceTimersByTime(2000));

test("closing a docked window glides the camera back to centre on the hedgehog (#148)", () => {
  const hog = { x: 1200, y: 1000 };
  show(DOCKED);
  act(() => camera.current!.lookAt(hog, { instant: true, centre: true }));
  // Docked: the hedgehog in the middle of what the window leaves of the view.
  expect(looking().x).toBe(hog.x - (VIEW.width - DOCKED) / 2);
  show(0);
  settle();
  expect(looking()).toEqual({ x: hog.x - VIEW.width / 2, y: hog.y - VIEW.height / 2 });
});

test("a window docking keeps the hedgehog in what's left of the view", () => {
  const hog = { x: 1200, y: 1000 };
  show(0);
  act(() => camera.current!.lookAt(hog, { instant: true, centre: true }));
  show(DOCKED);
  const x = hog.x - looking().x;
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(VIEW.width - DOCKED);
});

test("tells the world what it sees whenever it moves, so the desert's chunks come and go without a render (#156)", () => {
  views = [];
  show(0);
  act(() => camera.current!.lookAt({ x: -2000, y: -1500 }, { instant: true, centre: true }));
  expect(views.at(-1)).toEqual({ x: -2000 - VIEW.width / 2, y: -1500 - VIEW.height / 2, width: VIEW.width, height: VIEW.height });
});
