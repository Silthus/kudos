import { useCallback, useEffect, useRef, useState } from "react";

const hoverGrace = 150;

export type FloatingCardState = ReturnType<typeof useFloatingCard<HTMLElement>>;

export function useFloatingCard<Spot extends HTMLElement>() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const spot = useRef<Spot>(null);
  const card = useRef<HTMLDivElement>(null);
  const leaving = useRef<number | undefined>(undefined);
  const open = pinned || hovered;
  const close = useCallback(() => {
    window.clearTimeout(leaving.current);
    setPinned(false);
    setHovered(false);
  }, []);
  const hover = {
    onMouseEnter: () => {
      window.clearTimeout(leaving.current);
      setHovered(true);
    },
    onMouseLeave: () => {
      window.clearTimeout(leaving.current);
      leaving.current = window.setTimeout(() => setHovered(false), hoverGrace);
    },
  };
  useEffect(() => () => window.clearTimeout(leaving.current), []);
  useClosingOutside(open, spot, card, close);
  return { open, spot, card, hover, close, toggle: () => setPinned((was) => !was) };
}

function useClosingOutside(open: boolean, spot: React.RefObject<HTMLElement | null>, card: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!spot.current?.contains(target) && !card.current?.contains(target)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      spot.current?.querySelector("button")?.focus();
      close();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, spot, card, close]);
}
