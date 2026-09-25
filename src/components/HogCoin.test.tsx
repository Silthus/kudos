// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { HogCoin } from "./HogCoin";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(size?: number) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<HogCoin size={size} />));
  return host.querySelector<HTMLElement>("[data-hog-coin]")!;
}

test("the Hog coin is a pixel coin: a stepped gold rim drawn on a pixel grid, no gradients or soft shadows (#126)", () => {
  const coin = render(20);
  expect(coin.outerHTML).not.toMatch(/gradient/i);
  expect(coin.getAttribute("style") ?? "").not.toMatch(/box-shadow/);
  const rim = coin.querySelector("svg[data-coin-rim]")!;
  expect(rim.getAttribute("shape-rendering")).toBe("crispEdges");
  // Whole pixels only, in the dusk-garden palette.
  const rects = [...rim.querySelectorAll("rect")];
  expect(rects.length).toBeGreaterThan(10);
  for (const r of rects) for (const a of ["x", "y", "width", "height"]) expect(Number.isInteger(Number(r.getAttribute(a))), `${a}=${r.getAttribute(a)}`).toBe(true);
  const colours = new Set(rects.map((r) => r.getAttribute("fill")));
  expect([...colours].every((c) => ["#f7a501", "#5a3b2a", "#efe3c4", "#a83800", "#161226"].includes(c!))).toBe(true);
});

test("it snaps to a whole number of screen pixels per coin pixel (#126 integer scale)", () => {
  for (const [asked, drawn] of [[14, 12], [16, 12], [20, 24], [28, 24], [34, 36], [48, 48], [6, 12]]) {
    const coin = render(asked);
    expect([asked, coin.style.width, coin.style.height]).toEqual([asked, `${drawn}px`, `${drawn}px`]);
    act(() => root?.unmount());
  }
});

test("it never reads into the amount next to it", () => {
  const coin = render(28);
  expect(coin.getAttribute("aria-hidden")).toBe("true");
  expect(coin.textContent).toBe("");
});
