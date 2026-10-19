import { useCallback, useEffect, useRef } from "react";
export function useTitleFocusAfterChange(kind: string) {
  const lastShown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (kind === "loading") return;
    const changed = lastShown.current !== undefined && lastShown.current !== kind;
    lastShown.current = kind;
    if (changed) focusPageTitle();
  }, [kind]);
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
  if (aLandedSectionHoldsFocus()) return;
  document.querySelector<HTMLElement>("main h1")?.focus();
}

export function useTitleFocusOnArrival(arrivals = 0) {
  const arriving = useRef(false);
  useEffect(() => {
    if (arrivals > 0) arriving.current = true;
  }, [arrivals]);
  useEffect(() => {
    if (!arriving.current) return;
    if (document.querySelector("main h1") === null) return;
    arriving.current = false;
    focusPageTitle();
  });
  return useCallback(() => {
    arriving.current = true;
  }, []);
}

function aLandedSectionHoldsFocus() {
  return document.activeElement?.closest("main [data-panel-target]") != null;
}
