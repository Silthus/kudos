import { useEffect, useRef } from "react";
import type { ShellState } from "./shell";

type PageKind = ShellState["kind"];

export function useTitleFocusAfterChange(kind: PageKind) {
  const lastShown = useRef<PageKind | undefined>(undefined);
  useEffect(() => {
    if (kind === "loading") return;
    const changed = lastShown.current !== undefined && lastShown.current !== kind;
    lastShown.current = kind;
    if (changed) focusPageTitle();
  }, [kind]);
}

export function focusPageTitle() {
  document.querySelector<HTMLElement>("main h1")?.focus();
}
