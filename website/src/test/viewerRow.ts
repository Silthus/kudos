import { act } from "@testing-library/react";

type Seen = { visible: boolean; edge?: "top" | "bottom" };

type Watch = { target: Element; report: (seen: Seen) => void; watching: boolean };

export function watchTheViewerRow() {
  const watches: Watch[] = [];
  window.IntersectionObserver = class {
    private readonly mine: Watch[] = [];
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      const watch: Watch = { target, watching: true, report: (seen) => this.callback([entryOf(target, seen)], this as unknown as IntersectionObserver) };
      this.mine.push(watch);
      watches.push(watch);
    }
    disconnect() {
      for (const watch of this.mine) watch.watching = false;
    }
  } as unknown as typeof IntersectionObserver;
  return {
    see(seen: Seen) {
      const viewerRow = document.querySelector("[aria-label='The whole board'] [data-you]");
      const watch = watches.find((each) => each.watching && each.target === viewerRow);
      if (watch !== undefined) act(() => watch.report(seen));
    },
  };
}

function entryOf(target: Element, { visible, edge }: Seen) {
  return { target, isIntersecting: visible, boundingClientRect: { top: edge === "top" ? -200 : 900 }, rootBounds: { top: 0 } } as unknown as IntersectionObserverEntry;
}
