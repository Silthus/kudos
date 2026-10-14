type Listener = () => void;

export function fakeSystemTheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query === "(prefers-color-scheme: dark)" ? dark : false;
    },
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    turnDark(next: boolean) {
      dark = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export function preferReducedMotion() {
  const system = window.matchMedia;
  window.matchMedia = ((query: string) =>
    query === "(prefers-reduced-motion: reduce)" ? { ...system(query), media: query, matches: true } : system(query)) as typeof window.matchMedia;
}
