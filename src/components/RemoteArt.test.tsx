// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { RemoteArt } from "./RemoteArt";

/**
 * PostHog art loads from PostHog's servers (#101): until it has loaded, and for good if it fails,
 * the slot's own placeholder shows. The image reserves its size and loads lazily.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

const placeholder = <span data-testid="placeholder">placeholder</span>;

test("the placeholder shows under the art while it loads; the art is lazy, sized and hidden until it has loaded", () => {
  const host = render(<RemoteArt slot="hoggie-party" fallback={placeholder} className="h-10 w-10" />);
  const box = host.querySelector("[data-art-slot='hoggie-party']")!;
  expect(box.getAttribute("data-art")).toBe("loading");
  expect(host.querySelector("[data-testid=placeholder]")).not.toBeNull();
  const img = box.querySelector("img")!;
  expect(img.getAttribute("src")).toBe("https://cdn.jsdelivr.net/npm/@posthog/brand@0.12.3/dist/generated/hoggies/png/party.png");
  expect(img.getAttribute("loading")).toBe("lazy");
  expect(img.getAttribute("decoding")).toBe("async");
  expect(img.getAttribute("width")).toBe("1000");
  expect(img.getAttribute("height")).toBe("1000");
  expect(img.className).toContain("opacity-0");
});

test("once the art has loaded it shows over the placeholder", () => {
  const host = render(<RemoteArt slot="hoggie-party" fallback={placeholder} />);
  const img = host.querySelector("img")!;
  act(() => void img.dispatchEvent(new Event("load")));
  expect(host.querySelector("[data-art-slot]")!.getAttribute("data-art")).toBe("loaded");
  expect(host.querySelector("img")!.className).not.toContain("opacity-0");
});

test("if the art fails to load, the image goes and the placeholder stays", () => {
  const host = render(<RemoteArt slot="hoggie-party" fallback={placeholder} />);
  act(() => void host.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("[data-art-slot]")!.getAttribute("data-art")).toBe("fallback");
  expect(host.querySelector("[data-testid=placeholder]")).not.toBeNull();
});

test("a slot without PostHog art is only its placeholder, with no request at all", () => {
  const host = render(<RemoteArt slot="banner-starfield" fallback={placeholder} />);
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("[data-art-slot]")!.getAttribute("data-art")).toBe("fallback");
  expect(host.querySelector("[data-testid=placeholder]")).not.toBeNull();
});

test("an absolutely placed slot stays absolute (a frame behind a picture), and anything else holds its image in place", () => {
  const placed = render(<RemoteArt slot="frame-meadow" className="absolute inset-0" />).querySelector("[data-art-slot]")!;
  expect(placed.className.split(" ")).toContain("absolute");
  expect(placed.className.split(" ")).not.toContain("relative");
  act(() => root!.render(<RemoteArt slot="frame-meadow" className="h-4 w-4" />));
  expect(document.querySelector("[data-art-slot='frame-meadow']")!.className.split(" ")).toContain("relative");
});

test("a new slot starts loading afresh, even after the last one failed", () => {
  const host = render(<RemoteArt slot="hoggie-party" fallback={placeholder} />);
  act(() => void host.querySelector("img")!.dispatchEvent(new Event("error")));
  act(() => root!.render(<RemoteArt slot="hoggie-reader" fallback={placeholder} />));
  expect(host.querySelector("img")?.getAttribute("src")).toContain("/reading.png");
  expect(host.querySelector("[data-art-slot]")!.getAttribute("data-art")).toBe("loading");
});
