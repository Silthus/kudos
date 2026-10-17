// PROTOTYPE (#625): a free-floating game window: dragged by its title bar, raised on click, books snap to the left edge. Never merge to main.
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { place, placementOf, useDesk, type Placement, type WindowId } from "./desk";

export type WindowSize = { width: number; height: number };

const dockGap = 12;

const dockTop = 148;

const snapDistance = 28;

const tearDistance = 24;

export function phoneLayout() {
  return window.innerWidth < 760;
}

function defaultPlacement(id: WindowId, { width, height }: WindowSize, dockable: boolean): Placement {
  if (dockable) return { x: dockGap, y: dockTop, docked: true };
  const cascade: Partial<Record<WindowId, number>> = { bag: 0, market: 1, quests: 2, activity: 3, leaderboard: 4, settings: 1 };
  const step = (cascade[id] ?? 0) * 28;
  const room = window.innerWidth - 320;
  const x = id === "bag" ? room - width - 12 : Math.max(dockGap, Math.round((room - width) / 2) + 80 + step);
  const y = Math.max(dockTop, Math.min(window.innerHeight - height - 112, Math.round((window.innerHeight - height) / 2) - 40 + step));
  return { x: Math.max(dockGap, x), y, docked: false };
}

function clamped(x: number, y: number, { width }: WindowSize) {
  return { x: Math.min(window.innerWidth - 120, Math.max(-width + 160, x)), y: Math.min(window.innerHeight - 140, Math.max(8, y)) };
}

type Props = {
  id: WindowId;
  title: string;
  icon?: ReactNode;
  size: WindowSize;
  dockable?: boolean;
  className?: string;
  onClose: () => void;
  onFocus: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
};

export function FloatingWindow({ id, title, icon, size, dockable = false, className = "", onClose, onFocus, headerExtra, children }: Props) {
  const { open } = useDesk();
  const self = useRef<HTMLElement>(null);
  const drag = useRef<{ startX: number; startY: number; from: Placement; moved: boolean } | null>(null);
  const placement = placementOf(id) ?? defaultPlacement(id, size, dockable);
  const layer = open.indexOf(id);
  const front = layer === open.length - 1;

  useEffect(() => {
    self.current?.querySelector<HTMLElement>(".wm-window-title")?.focus({ preventScroll: true });
  }, []);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (phoneLayout() || event.button !== 0 || (event.target as HTMLElement).closest("button, a, input, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, from: placement, moved: false };
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    const element = self.current;
    if (current === null || element === null) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < (current.from.docked ? tearDistance : 3)) return;
    current.moved = true;
    const next = clamped(current.from.x + dx, current.from.y + dy, size);
    element.classList.remove("wm-docked");
    element.classList.toggle("wm-snap-hint", dockable && next.x < snapDistance);
    element.style.left = `${next.x}px`;
    element.style.top = `${next.y}px`;
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    drag.current = null;
    const element = self.current;
    if (current === null || !current.moved || element === null) return;
    element.classList.remove("wm-snap-hint");
    const next = clamped(current.from.x + event.clientX - current.startX, current.from.y + event.clientY - current.startY, size);
    place(id, dockable && next.x < snapDistance ? { x: dockGap, y: dockTop, docked: true } : { ...next, docked: false });
  };

  const style = { left: placement.x, top: placement.y, width: size.width, height: size.height, zIndex: 60 + Math.max(0, layer) } as CSSProperties;

  return (
    <section ref={self} role="dialog" aria-label={title} data-wm-window={id} className={`wm-window ${placement.docked ? "wm-docked" : ""} ${front ? "wm-window-front" : ""} ${className}`} style={style} onPointerDownCapture={onFocus}>
      <header className="wm-window-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={() => dockable && place(id, placement.docked ? { ...defaultPlacement("bag", size, false), docked: false } : { x: dockGap, y: dockTop, docked: true })}>
        {icon !== undefined && <span className="wm-window-icon" aria-hidden="true">{icon}</span>}
        <h2 className="wm-window-title" tabIndex={-1}>
          {title}
        </h2>
        {dockable && <span className="wm-window-dock">{placement.docked ? "Docked · drag to tear off" : "Drag to the left edge to dock"}</span>}
        {headerExtra}
        <button type="button" className="wm-window-close" onClick={onClose} aria-label={`Close ${title}`} title="Close (Esc)">
          ✕
        </button>
      </header>
      <div className="wm-window-body">{children}</div>
    </section>
  );
}
