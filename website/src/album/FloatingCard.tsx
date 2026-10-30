import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placementOf, roomOnScreen, type Placement } from "./floatingCard";
import type { FloatingCardState } from "./useFloatingCard";
import "./floatingCard.css";

export function FloatingCard({ state, label, children }: { state: FloatingCardState; label: string; children: ReactNode }) {
  const placement = usePlacement(state);
  const host = document.querySelector(".al-shell") ?? document.body;
  return createPortal(
    <div
      ref={state.card}
      role="dialog"
      aria-label={label}
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
