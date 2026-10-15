import { IconChevronDown } from "@posthog/icons";
import { Button, Card } from "@posthog/quill";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { LeaderboardRow } from "../shell";
import type { PeopleBoard } from "./boards";
import { useTitleFocusWhenTheFocusedElementGoes } from "../pageFocus";
import { BoardLine } from "./BoardLine";
import { WholeBoard } from "./WholeBoard";

const step = 5;
const firstBelowThePodium = 4;

type Span = { first: number; last: number };

export function BoardList({ board, after }: { board: PeopleBoard; after?: ReactNode }) {
  const [whole, setWhole] = useState(false);
  const [grown, setGrown] = useState({ above: 0, below: 0 });
  const lines = useRef<HTMLOListElement>(null);
  const focusOnReveal = useFocusOnReveal(lines);
  useTitleFocusWhenTheFocusedElementGoes();
  const wholeBoardId = useId();
  const total = board.rows.length;
  const span = grownSpan(windowSpan(board.window), grown, total);
  const hiddenAbove = span.first - firstBelowThePodium;
  const hiddenBelow = Math.max(0, total - span.last);
  const listed = positionsIn(span);
  const offersTheWholeBoard = whole || total > board.window.length;
  const hasLines = whole || listed.length > 0;
  const backToTheWindow = () => {
    setGrown({ above: 0, below: 0 });
    setWhole(false);
  };
  const showAbove = () => {
    setGrown({ ...grown, above: grown.above + step });
    focusOnReveal(span.first - Math.min(step, hiddenAbove));
  };
  const showBelow = () => {
    setGrown({ ...grown, below: grown.below + step });
    focusOnReveal(span.last + 1);
  };
  if (!hasLines && after === undefined && !offersTheWholeBoard) return null;
  return (
    <Card size="sm" className="gap-0 overflow-hidden py-0">
      {hasLines && <ColumnHeader />}
      {whole ? (
        <WholeBoard id={wholeBoardId} rows={board.rows} />
      ) : (
        <WindowLines lines={lines} rows={board.rows} listed={listed} hiddenAbove={hiddenAbove} hiddenBelow={hiddenBelow} onShowAbove={showAbove} onShowBelow={showBelow} />
      )}
      {after}
      {offersTheWholeBoard && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <span className="hud-label tabular-nums">{whole ? `No. 1–${total} of ${total}` : shownRange(listed.length > 0 ? listed : board.window, total)}</span>
          <Button variant="outline" size="sm" aria-expanded={whole} aria-controls={whole ? wholeBoardId : undefined} onClick={whole ? backToTheWindow : () => setWhole(true)}>
            {whole ? returnWords(board) : "Show the whole board"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function useFocusOnReveal(lines: RefObject<HTMLOListElement | null>) {
  const pending = useRef<number>(undefined);
  useEffect(() => {
    if (pending.current === undefined) return;
    lines.current?.querySelector<HTMLElement>(`[data-position="${pending.current}"]`)?.focus();
    pending.current = undefined;
  });
  return (position: number) => {
    pending.current = position;
  };
}

function windowSpan(window: number[]): Span {
  const below = window.filter((position) => position >= firstBelowThePodium);
  return { first: below[0] ?? firstBelowThePodium, last: below.at(-1) ?? firstBelowThePodium - 1 };
}

function grownSpan({ first, last }: Span, grown: { above: number; below: number }, total: number): Span {
  return { first: Math.max(firstBelowThePodium, first - grown.above), last: Math.min(total, last + grown.below) };
}

function positionsIn({ first, last }: Span) {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

function ColumnHeader() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between px-3 py-2">
      <span className="hud-label">No. · member</span>
      <span className="hud-label">Kudos given</span>
    </div>
  );
}

function shownRange(positions: number[], total: number) {
  return `No. ${positions[0]}–${positions.at(-1)} of ${total}`;
}

function returnWords({ standing }: PeopleBoard) {
  return standing.kind === "ranked" ? "Back to my spot" : "Show fewer";
}

type WindowLinesProps = {
  lines: RefObject<HTMLOListElement | null>;
  rows: LeaderboardRow[];
  listed: number[];
  hiddenAbove: number;
  hiddenBelow: number;
  onShowAbove: () => void;
  onShowBelow: () => void;
};

function WindowLines({ lines, rows, listed, hiddenAbove, hiddenBelow, onShowAbove, onShowBelow }: WindowLinesProps) {
  if (listed.length === 0 && hiddenBelow === 0) return null;
  return (
    <ol ref={lines} aria-label="No. · member, kudos given" className="flex flex-col">
      {hiddenAbove > 0 && <MoreLine side="above" count={Math.min(step, hiddenAbove)} onShow={onShowAbove} />}
      {listed.map((position) => (
        <BoardLine key={position} row={rows[position - 1]!} revealable />
      ))}
      {hiddenBelow > 0 && <MoreLine side="below" count={Math.min(step, hiddenBelow)} onShow={onShowBelow} />}
    </ol>
  );
}

function MoreLine({ side, count, onShow }: { side: "above" | "below"; count: number; onShow: () => void }) {
  return (
    <li className="flex items-center gap-3 border-t px-3 py-1.5">
      <span aria-hidden="true" className="h-px flex-1 border-t border-dashed" />
      <Button variant="link-muted" size="xs" onClick={onShow}>
        <IconChevronDown aria-hidden="true" className={`size-3.5 ${side === "above" ? "rotate-180" : ""}`} />
        Show {count} more {side}
      </Button>
      <span aria-hidden="true" className="h-px flex-1 border-t border-dashed" />
    </li>
  );
}
