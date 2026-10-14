import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LeaderboardRow } from "../shell";
import { BoardLine, JumpToMe } from "./BoardLine";

type Edge = "top" | "bottom";

export function WholeBoard({ id, rows }: { id: string; rows: LeaderboardRow[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const mine = rows.find((row) => row.you);
  const edge = useEdgeOfTheViewerRow(scroller, mine?.position);

  useLayoutEffect(() => centreTheViewerRow(scroller.current, "instant"), []);

  const jumpToMe = () => {
    centreTheViewerRow(scroller.current, prefersReducedMotion() ? "instant" : "smooth");
    viewerRowIn(scroller.current)?.focus({ preventScroll: true });
  };

  return (
    <div className="relative border-t">
      <div id={id} ref={scroller} role="region" aria-label="The whole board" tabIndex={0} className="relative max-h-[26rem] overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <ol className="flex flex-col [&>li:first-child]:border-t-0">
          {rows.map((row) => (
            <BoardLine key={row.position} row={row} focusable />
          ))}
        </ol>
      </div>
      {mine && edge && (
        <div data-pinned={edge} className={`absolute inset-x-0 z-10 flex items-center bg-card ${edge === "top" ? "top-0 border-b" : "bottom-0 border-t"}`}>
          <div className="flex min-w-0 flex-1 items-center bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]">
            <ul aria-hidden="true" className="min-w-0 flex-1 [&>li]:border-t-0 [&>li]:shadow-none">
              <BoardLine row={mine} />
            </ul>
            <JumpToMe onJump={jumpToMe} />
          </div>
        </div>
      )}
    </div>
  );
}

function viewerRowIn(scroller: HTMLElement | null) {
  return scroller?.querySelector<HTMLElement>("[data-you]") ?? null;
}

function centreTheViewerRow(scroller: HTMLElement | null, behavior: ScrollBehavior) {
  const row = viewerRowIn(scroller);
  if (scroller === null || row === null) return;
  scroller.scrollTo({ top: row.offsetTop - (scroller.clientHeight - row.offsetHeight) / 2, behavior });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useEdgeOfTheViewerRow(scroller: RefObject<HTMLDivElement | null>, viewerPosition: number | undefined) {
  const [edge, setEdge] = useState<Edge>();
  useEffect(() => {
    setEdge(undefined);
    const row = viewerRowIn(scroller.current);
    if (row === null || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(
      ([seen]) => {
        if (seen === undefined) return;
        if (seen.isIntersecting) return setEdge(undefined);
        setEdge(seen.boundingClientRect.top < (seen.rootBounds?.top ?? 0) ? "top" : "bottom");
      },
      { root: scroller.current, threshold: 0.6 },
    );
    watch.observe(row);
    return () => watch.disconnect();
  }, [scroller, viewerPosition]);
  return edge;
}
