// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { layout } from "../../convex/lib/tree";
import { GroundLayer } from "./groundLayer";
import { chunkRect, chunksIn } from "./paint";
import { buildWorld } from "./world";

/**
 * The ground on screen (#156): a canvas per chunk in view, added as the camera comes near and
 * dropped as it leaves, painted a few a frame off React's render path.
 */

const world = buildWorld({ seed: 3, layout: layout(3, 400), planted: true, standing: [] });
let painted: string[] = [];
let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval"] });
  painted = [];
  // A canvas that records which chunk it painted.
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return {
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => painted.push(this.dataset.chunk ?? "shimmer"),
    };
  } as never;
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  vi.useRealTimers();
});

const view = (x: number, y: number) => ({ x, y, width: 427, height: 300 });
const shown = () => [...host.querySelectorAll<HTMLCanvasElement>("canvas[data-chunk]")].map((c) => c.dataset.chunk!).sort();
const wanted = (v: ReturnType<typeof view>) => chunksIn(v).map((c) => `${c.cx},${c.cy}`).sort();

test("shows exactly the chunks in view, the ones on screen painted at once for the first paint", () => {
  const layer = new GroundLayer(host);
  layer.setWorld(world, "a");
  layer.show(view(-200, -150));
  const onScreen = chunksIn(view(-200, -150), 0).map((c) => `${c.cx},${c.cy}`);
  for (const id of onScreen) expect(painted, id).toContain(id);
  vi.runAllTimers();
  expect(shown()).toEqual(wanted(view(-200, -150)));
  layer.destroy();
});

test("walking away drops the chunks left behind and brings in the new ones, a few a frame", () => {
  const layer = new GroundLayer(host);
  layer.setWorld(world, "a");
  layer.show(view(-200, -150));
  vi.runAllTimers();
  painted = [];
  const far = view(3000, 1500);
  layer.show(far);
  // Not all at once: a frame's worth, the rest on the frames after.
  expect(painted.filter((p) => p !== "shimmer").length).toBeLessThanOrEqual(3);
  vi.runAllTimers();
  expect(shown()).toEqual(wanted(far));
  expect(shown().some((id) => wanted(view(-200, -150)).includes(id))).toBe(false);
  layer.destroy();
});

test("a camera move that sees the same chunks does nothing", () => {
  const layer = new GroundLayer(host);
  layer.setWorld(world, "a");
  layer.show(view(-200, -150));
  vi.runAllTimers();
  painted = [];
  const before = [...host.querySelectorAll("canvas")];
  layer.show(view(-199, -150));
  vi.runAllTimers();
  expect(painted).toEqual([]);
  expect([...host.querySelectorAll("canvas")]).toEqual(before);
  layer.destroy();
});

test("coming back, a chunk painted a moment ago isn't painted again; a new world repaints them all", () => {
  const layer = new GroundLayer(host);
  layer.setWorld(world, "a");
  layer.show(view(-200, -150));
  vi.runAllTimers();
  layer.show(view(3000, 1500));
  vi.runAllTimers();
  painted = [];
  layer.show(view(-200, -150));
  vi.runAllTimers();
  expect(painted).toEqual([]);
  layer.setWorld(world, "b");
  vi.runAllTimers();
  expect(painted.filter((p) => p !== "shimmer").sort()).toEqual(wanted(view(-200, -150)));
  layer.destroy();
});

test("only a chunk with water has a second canvas, for the water's shimmer", () => {
  const layer = new GroundLayer(host);
  layer.setWorld(world, "a");
  const v = view(-200, -150);
  layer.show(v);
  vi.runAllTimers();
  const watery = chunksIn(v).filter(({ cx, cy }) => {
    for (let y = cy * 32; y < cy * 32 + 32; y++) for (let x = cx * 32; x < cx * 32 + 32; x++) if (world.terrainAt(x, y) === "water") return true;
    return false;
  });
  expect(watery.length).toBeLessThan(chunksIn(v).length);
  expect(host.querySelectorAll("canvas:not([data-chunk])")).toHaveLength(watery.length);
  layer.destroy();
});

test("sits each chunk canvas where its tiles are, at the world's scale", () => {
  const layer = new GroundLayer(host);
  layer.setScale(3);
  layer.setWorld(world, "a");
  layer.show(view(-200, -150));
  const el = host.querySelector<HTMLCanvasElement>("canvas[data-chunk='0,0']")!;
  const r = chunkRect(0, 0);
  expect([el.style.left, el.style.top, el.style.width]).toEqual([`${r.x * 3}px`, `${r.y * 3}px`, `${r.width * 3}px`]);
  layer.destroy();
});
