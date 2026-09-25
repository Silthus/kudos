import { useReducedMotion } from "motion/react";
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import type { Point } from "./iso";

/**
 * The camera (#126 "Layout"): the world at a whole-number scale, following the hedgehog with a dead
 * zone, draggable by mouse or finger. It moves by writing a transform on the stage, never through
 * React state, so walking re-renders nothing.
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

/** How much sky may show past the world's edge. */
const EDGE = 48;

/** Keeps the world on screen; a world smaller than the view sits in its middle. */
export function clampCamera(cam: Point, view: Size, stage: Size): Point {
  const axis = (c: number, v: number, s: number) => (s <= v ? (s - v) / 2 : Math.min(Math.max(c, -EDGE), s - v + EDGE));
  return { x: axis(cam.x, view.width, stage.width), y: axis(cam.y, view.height, stage.height) };
}

export type CameraHandle = {
  /** Keeps a stage point in view: at once, or gliding there. `centre` puts it in the middle. */
  lookAt: (p: Point, how?: { instant?: boolean; centre?: boolean }) => void;
};

export function Camera({
  stage,
  insetRight = 0,
  onTap,
  children,
  ref,
}: {
  /** The stage's size in screen pixels. */
  stage: Size;
  /** Screen pixels on the right covered by a docked window: the view is what's left of it. */
  insetRight?: number;
  /** A tap or click that wasn't a drag, at a stage point. */
  onTap: (p: Point) => void;
  children: ReactNode;
  ref?: Ref<CameraHandle>;
}) {
  const still = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const cam = useRef<Point>({ x: 0, y: 0 });
  const goal = useRef<Point>({ x: 0, y: 0 });
  const lastLook = useRef<Point | null>(null);
  const frame = useRef(0);
  const drag = useRef<{ id: number; start: Point; cam: Point; moved: boolean } | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const inset = useRef(insetRight);
  inset.current = insetRight;

  const view = (): Size => ({ width: Math.max(1, (viewport.current?.clientWidth ?? window.innerWidth) - inset.current), height: viewport.current?.clientHeight ?? window.innerHeight });
  const apply = () => {
    if (stageEl.current) stageEl.current.style.transform = `translate3d(${-Math.round(cam.current.x)}px, ${-Math.round(cam.current.y)}px, 0)`;
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
    const next = clampCamera(how.centre ? centreOn(p, v) : follow(goal.current, p, v), v, stageRef.current);
    goal.current = next;
    if (how.instant || still) {
      cancelAnimationFrame(frame.current);
      cam.current = next;
      apply();
    } else glide();
  };
  useImperativeHandle(ref, () => ({ lookAt }));

  // A new size or a window docking: keep the hedgehog in what's left of the view.
  useEffect(() => {
    const again = () => lastLook.current && lookAt(lastLook.current, { instant: true });
    again();
    window.addEventListener("resize", again);
    return () => window.removeEventListener("resize", again);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.width, stage.height, insetRight]);
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
        cam.current = clampCamera({ x: d.cam.x - dx, y: d.cam.y - dy }, view(), stageRef.current);
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
      <div ref={stageEl} className="absolute left-0 top-0 will-change-transform" style={{ width: stage.width, height: stage.height }}>
        {children}
      </div>
    </div>
  );
}
