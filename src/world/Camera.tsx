import { useReducedMotionConfig } from "motion/react";
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import type { Point } from "./iso";

/**
 * The camera (#126 "Layout"): the world at a whole-number scale, following the hedgehog with a dead
 * zone, draggable by mouse or finger, over a plane with no edge (#156). It moves by writing a
 * transform on the stage, never through React state, so walking re-renders nothing; each move tells
 * `onView` what it sees, so the desert's chunks come and go the same way.
 */

type Size = { width: number; height: number };

/** The world's scale for a viewport width: 2× on a phone, 3× wider. */
export function worldScale(viewportWidth: number) {
  return viewportWidth < 640 ? 2 : 3;
}

/** The camera position (the view's top-left on the stage) that centres a point. */
export function centreOn(p: Point, view: Size): Point {
  return { x: p.x - view.width / 2, y: p.y - view.height / 2 };
}

/** The middle of the view the hedgehog may roam without the camera moving, as a share of it. */
const DEAD_ZONE = 0.4;

/** Moves the camera just enough to keep a point inside the middle of the view. */
export function follow(cam: Point, p: Point, view: Size): Point {
  const box = (size: number) => [(size * (1 - DEAD_ZONE)) / 2, (size * (1 + DEAD_ZONE)) / 2];
  const [x0, x1] = box(view.width);
  const [y0, y1] = box(view.height);
  const vx = p.x - cam.x;
  const vy = p.y - cam.y;
  return { x: cam.x + (vx < x0 ? vx - x0 : vx > x1 ? vx - x1 : 0), y: cam.y + (vy < y0 ? vy - y0 : vy > y1 ? vy - y1 : 0) };
}

export type CameraHandle = {
  /** Keeps a stage point in view: at once, or gliding there. `centre` puts it in the middle. */
  lookAt: (p: Point, how?: { instant?: boolean; centre?: boolean }) => void;
};

/** What the camera sees: a rectangle of the stage, in screen pixels. */
export type View = { x: number; y: number; width: number; height: number };

export function Camera({
  insetRight = 0,
  onTap,
  onView,
  children,
  ref,
}: {
  /** Screen pixels on the right covered by a docked window: the view is what's left of it. */
  insetRight?: number;
  /** A tap or click that wasn't a drag, at a stage point. */
  onTap: (p: Point) => void;
  /** Where the camera looks now, after every move. */
  onView?: (view: View) => void;
  children: ReactNode;
  ref?: Ref<CameraHandle>;
}) {
  const still = useReducedMotionConfig();
  const viewport = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const cam = useRef<Point>({ x: 0, y: 0 });
  const goal = useRef<Point>({ x: 0, y: 0 });
  const lastLook = useRef<Point | null>(null);
  const frame = useRef(0);
  const drag = useRef<{ id: number; start: Point; cam: Point; moved: boolean } | null>(null);
  const viewed = useRef(onView);
  viewed.current = onView;
  const inset = useRef(insetRight);
  inset.current = insetRight;

  const view = (): Size => ({ width: Math.max(1, (viewport.current?.clientWidth ?? window.innerWidth) - inset.current), height: viewport.current?.clientHeight ?? window.innerHeight });
  const apply = () => {
    const x = Math.round(cam.current.x);
    const y = Math.round(cam.current.y);
    if (stageEl.current) stageEl.current.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
    // The whole viewport, window or not: the ground under a docked window still shows at its edge.
    viewed.current?.({ x, y, width: viewport.current?.clientWidth ?? window.innerWidth, height: viewport.current?.clientHeight ?? window.innerHeight });
  };
  const glide = () => {
    cancelAnimationFrame(frame.current);
    const tick = () => {
      const dx = goal.current.x - cam.current.x;
      const dy = goal.current.y - cam.current.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        cam.current = { ...goal.current };
        apply();
        return;
      }
      cam.current = { x: cam.current.x + dx * 0.18, y: cam.current.y + dy * 0.18 };
      apply();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const lookAt: CameraHandle["lookAt"] = (p, how = {}) => {
    lastLook.current = p;
    const v = view();
    const next = how.centre ? centreOn(p, v) : follow(goal.current, p, v);
    goal.current = next;
    if (how.instant || still) {
      cancelAnimationFrame(frame.current);
      cam.current = next;
      apply();
    } else glide();
  };
  useImperativeHandle(ref, () => ({ lookAt }));

  // A new size or a window docking: keep the hedgehog in what's left of the view. A window closing
  // gives the view back: glide to centre on the hedgehog, or it stays off to the left with the
  // places on that side out of view (#148).
  const lastInset = useRef(insetRight);
  useEffect(() => {
    const again = () => lastLook.current && lookAt(lastLook.current, { instant: true });
    const widened = insetRight < lastInset.current;
    lastInset.current = insetRight;
    if (widened && lastLook.current) lookAt(lastLook.current, { centre: true });
    else again();
    window.addEventListener("resize", again);
    return () => window.removeEventListener("resize", again);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetRight]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div
      ref={viewport}
      className="fixed inset-0 touch-none select-none overflow-hidden"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, cam: { ...cam.current }, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.start.x;
        const dy = e.clientY - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) < 6) return;
        if (!d.moved) viewport.current?.setPointerCapture?.(e.pointerId);
        d.moved = true;
        cancelAnimationFrame(frame.current);
        cam.current = { x: d.cam.x - dx, y: d.cam.y - dy };
        goal.current = { ...cam.current };
        apply();
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved || d.id !== e.pointerId) return;
        const box = viewport.current!.getBoundingClientRect();
        onTap({ x: e.clientX - box.left + cam.current.x, y: e.clientY - box.top + cam.current.y });
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      <div ref={stageEl} className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        {children}
      </div>
    </div>
  );
}
