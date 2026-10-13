import { act } from "@testing-library/react";

type Sighting = (seen: { visible: boolean; edge?: "top" | "bottom" }) => void;

export function watchTheViewerRow() {
  const sightings: Sighting[] = [];
  window.IntersectionObserver = class {
    constructor(private readonly report: IntersectionObserverCallback) {}
    observe(target: Element) {
      sightings.push(({ visible, edge }) =>
        act(() =>
          this.report(
            [{ target, isIntersecting: visible, boundingClientRect: { top: edge === "top" ? -200 : 900 }, rootBounds: { top: 0 } } as unknown as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          ),
        ),
      );
    }
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  return { see: (seen: Parameters<Sighting>[0]) => sightings.at(-1)!(seen) };
}
