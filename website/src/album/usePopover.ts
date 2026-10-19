import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type Popover<Name extends string> = { open: Name | null; toggle(name: Name): void; show(name: Name): void; close(): void; anchor: RefObject<HTMLElement | null> };

export function usePopover<Name extends string>(): Popover<Name> {
  const [open, setOpen] = useState<Name | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = useCallback((name: Name) => setOpen((current) => (current === name ? null : name)), []);
  const show = useCallback((name: Name) => setOpen(name), []);
  useEffect(() => {
    if (open === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      anchor.current?.querySelector("button")?.focus();
      close();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node) && !isInAWizard(event.target)) close();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open, close]);
  return { open, toggle, show, close, anchor };
}

function isInAWizard(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".al-wizard-backdrop") !== null;
}
