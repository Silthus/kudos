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

export function useTitleFocusWhenTheFocusedElementGoes() {
  const lastFocused = useRef<Element | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      lastFocused.current = event.target as Element;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  useEffect(() => {
    const gone = lastFocused.current;
    if (gone === null || gone.isConnected || document.activeElement !== document.body) return;
    lastFocused.current = null;
    focusPageTitle();
  });
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
