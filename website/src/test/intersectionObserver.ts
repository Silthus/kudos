const watchers = new Map<Element, Set<FakeIntersectionObserver>>();

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds: readonly number[];
  private readonly watched = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    const threshold = options.threshold ?? 0;
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
  }

  observe(target: Element) {
    this.watched.add(target);
    watchers.set(target, (watchers.get(target) ?? new Set()).add(this));
  }

  unobserve(target: Element) {
    this.watched.delete(target);
    watchers.get(target)?.delete(this);
  }

  disconnect() {
    for (const target of this.watched) watchers.get(target)?.delete(this);
    this.watched.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  report(target: Element, ratio: number) {
    const box = target.getBoundingClientRect();
    this.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio, boundingClientRect: box, intersectionRect: box, rootBounds: null, time: performance.now() }], this);
  }
}

export function scrollIntoViewport(target: Element, ratio = 1) {
  for (const observer of watchers.get(target) ?? []) observer.report(target, ratio);
}

export function scrollOutOfViewport(target: Element) {
  scrollIntoViewport(target, 0);
}

window.IntersectionObserver ??= FakeIntersectionObserver;
