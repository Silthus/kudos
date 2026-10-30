import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placementOf, roomOnScreen, type Placement } from "./floatingCard";
import type { FloatingCardState } from "./useFloatingCard";
import "./floatingCard.css";

export function FloatingCard({ state, titleId, children }: { state: FloatingCardState; titleId: string; children: ReactNode }) {
  const placement = usePlacement(state);
  useFocusWhenPinned(state, placement !== null);
  const host = document.querySelector(".al-shell") ?? document.body;
  return createPortal(
    <div
      ref={state.card}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="al-floating"
      data-side={placement?.side}
      style={{ top: placement?.top ?? 0, left: placement?.left ?? 0, visibility: placement === null ? "hidden" : undefined }}
      {...state.hover}
    >
      <button type="button" className="al-floating-close" aria-label="Close" onClick={state.close}>
        ×
      </button>
      {children}
    </div>,
    host,
  );
}

function useFocusWhenPinned({ pinned, card }: FloatingCardState, placed: boolean) {
  useEffect(() => {
    if (pinned && placed) card.current?.focus({ preventScroll: true });
  }, [pinned, placed, card]);
}

function usePlacement({ spot, card }: FloatingCardState) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (spot.current === null || card.current === null) return;
      setPlacement(placementOf(spot.current.getBoundingClientRect(), { width: card.current.offsetWidth, height: card.current.offsetHeight }, roomOnScreen()));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [spot, card]);
  return placement;
}
