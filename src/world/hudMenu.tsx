import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The HUD's small disclosure menus (#126, #128): the Places list, settings, who's online and the
 * tutorial's checklist (#159). A button opens a parchment panel; Escape, a click elsewhere or
 * tabbing out closes it.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button, select")?.focus();
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    setOpen(false);
    button.current?.focus();
  };
  /** Tabbing out of the menu closes it. */
  const onFocusOut = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !e.currentTarget.contains(to)) setOpen(false);
  };
  return { open, setOpen, button, panel, onKeyDown, onFocusOut };
}

/** A menu's panel, under its button in the top corners; `className` moves it (above, for the caption's). */
export function MenuPanel({ id, panel, children, className }: { id: string; panel: React.RefObject<HTMLDivElement | null>; children: ReactNode; className?: string }) {
  return (
    <div ref={panel} id={id} data-hud-menu className={clsx("pixel-frame absolute right-0 top-full z-10 mt-3 max-h-[calc(100dvh-88px)] w-72 max-w-[calc(100vw-24px)] overflow-y-auto p-2", className)}>
      {children}
    </div>
  );
}
