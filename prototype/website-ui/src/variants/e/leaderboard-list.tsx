// Variant E leaderboard list: the rows below the podium centred on you, growing five at a time up or down, or the whole board in a scroll area that pins your row to its edge.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown, IconTarget } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useReducedMotion } from "./hud";

export type Entry = { key: string; position: number; mine: boolean; line: ReactNode };

type Window = { lo: number; hi: number };

const step = 5;
const reach = 3;
const belowPodiumInTopTen = 7;

function aroundMe(entries: Entry[]): Window {
  const last = entries.length - 1;
  const mine = entries.findIndex((e) => e.mine);
  if (mine < belowPodiumInTopTen) return { lo: 0, hi: Math.min(last, Math.max(belowPodiumInTopTen - 1, mine + reach)) };
  return { lo: mine - reach, hi: Math.min(last, mine + reach) };
}

export function BoardList({ entries }: { entries: Entry[] }) {
  const [shown, setShown] = useState(() => aroundMe(entries));
  const [whole, setWhole] = useState(false);
  const last = entries.length - 1;
  const clipped = shown.lo > 0 || shown.hi < last;
  const back = () => {
    setShown(aroundMe(entries));
    setWhole(false);
  };
  return (
    <>
      {whole ? (
        <WholeBoard entries={entries} />
      ) : (
        <ol className="flex flex-col">
          {shown.lo > 0 && <MoreLine up count={Math.min(step, shown.lo)} onClick={() => setShown({ ...shown, lo: Math.max(0, shown.lo - step) })} />}
          {entries.slice(shown.lo, shown.hi + 1).map((e) => (
            <Fragment key={e.key}>{e.line}</Fragment>
          ))}
          {shown.hi < last && <MoreLine count={Math.min(step, last - shown.hi)} onClick={() => setShown({ ...shown, hi: Math.min(last, shown.hi + step) })} />}
        </ol>
      )}
      {(clipped || whole) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <span className="hud-label">{whole ? `No. ${entries[0].position}–${entries[last].position} · scroll` : `No. ${entries[shown.lo].position}–${entries[shown.hi].position} of ${entries[last].position}`}</span>
          <Button variant="outline" size="sm" onClick={whole ? back : () => setWhole(true)}>
            {whole ? (entries.some((e) => e.mine) ? "Back to my spot" : "Show fewer") : "Show the whole board"}
          </Button>
        </div>
      )}
    </>
  );
}

function MoreLine({ up = false, count, onClick }: { up?: boolean; count: number; onClick: () => void }) {
  return (
    <li className="flex items-center gap-3 border-t px-3 py-1.5">
      <span className="h-px flex-1 border-t border-dashed" />
      <Button variant="link-muted" size="xs" onClick={onClick}>
        <IconChevronDown className={`size-3.5 ${up ? "rotate-180" : ""}`} />
        Show {count} more {up ? "above" : "below"}
      </Button>
      <span className="h-px flex-1 border-t border-dashed" />
    </li>
  );
}

type Edge = "top" | "bottom" | undefined;

function WholeBoard({ entries }: { entries: Entry[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [edge, setEdge] = useState<Edge>();
  const mine = entries.find((e) => e.mine);
  const myRow = () => scroller.current?.querySelector<HTMLElement>("[data-mine]") ?? null;
  const centreOnMe = (behavior: ScrollBehavior) => {
    const box = scroller.current;
    const row = myRow();
    if (box && row) box.scrollTo({ top: row.offsetTop - (box.clientHeight - row.offsetHeight) / 2, behavior });
  };

  useLayoutEffect(() => centreOnMe("auto"), []);

  useEffect(() => {
    const box = scroller.current;
    const row = myRow();
    if (!box || !row) return;
    const watch = new IntersectionObserver(([seen]) => {
      if (seen.isIntersecting) return setEdge(undefined);
      setEdge(seen.boundingClientRect.top < (seen.rootBounds?.top ?? 0) ? "top" : "bottom");
    }, { root: box, threshold: 0.6 });
    watch.observe(row);
    return () => watch.disconnect();
  }, []);

  return (
    <div className="relative border-t">
      <div ref={scroller} className="relative max-h-[26rem] overflow-y-auto overscroll-contain [&>ol>li:first-child]:border-t-0" tabIndex={0} aria-label="The whole board">
        <ol className="flex flex-col">
          {entries.map((e) => (
            <Fragment key={e.key}>{e.line}</Fragment>
          ))}
        </ol>
      </div>
      {mine && edge && (
        <div className={`hud-fade absolute inset-x-0 z-10 bg-card ${edge === "top" ? "top-0 border-b shadow-[0_6px_12px_-8px_rgb(0_0_0/0.35)]" : "bottom-0 border-t shadow-[0_-6px_12px_-8px_rgb(0_0_0/0.35)]"}`}>
          <div className="flex items-center bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]">
            <ul className="min-w-0 flex-1 [&>li]:border-t-0 [&>li]:bg-transparent [&>li]:shadow-none" aria-hidden>
              {mine.line}
            </ul>
            <Button variant="outline" size="sm" className="mr-3 shrink-0" onClick={() => centreOnMe(reduced ? "auto" : "smooth")}>
              <IconTarget className="size-3.5" />
              Jump to me
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
