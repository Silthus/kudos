import { useCallback, useEffect, useRef } from "react";
export function useTitleFocusAfterChange(kind: string, { held }: { held: boolean }) {
  const lastShown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (kind === "loading") return;
    const changed = lastShown.current !== undefined && lastShown.current !== kind;
    lastShown.current = kind;
    if (changed && !held) focusPageTitle();
  }, [kind, held]);
}

export function focusPageTitle() {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

export function useTitleFocusOnArrival() {
  const arriving = useRef(false);
  useEffect(() => {
    if (!arriving.current) return;
    const title = document.querySelector<HTMLElement>("main h1");
    if (title === null) return;
    arriving.current = false;
    title.focus();
  });
  return useCallback(() => {
    arriving.current = true;
  }, []);
}
