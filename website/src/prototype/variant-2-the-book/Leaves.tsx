// PROTOTYPE (#625): the open spread and the leaves that turn over it, one for a page turn, a riffle for a chapter jump. Never merge to main.
import type { CSSProperties } from "react";
import { PageFace } from "./Page";
import type { NumberedPage, Spread } from "./spreads";

export type Turn = { from: number; to: number };

const singleTurnMs = 620;

const riffleTurnMs = 420;

const riffleStaggerMs = 85;

const mostLeaves = 5;

function leafCountOf({ from, to }: Turn) {
  return Math.min(Math.abs(to - from), mostLeaves);
}

export function durationOf(turn: Turn) {
  const leaves = leafCountOf(turn);
  return leaves === 1 ? singleTurnMs : riffleTurnMs + (leaves - 1) * riffleStaggerMs;
}

type Leaf = { front: NumberedPage | null; back: NumberedPage | null };

function leavesOf(turn: Turn, spreads: Spread[]): Leaf[] {
  const forward = turn.to > turn.from;
  const count = leafCountOf(turn);
  const from = spreads[turn.from]!;
  const to = spreads[turn.to]!;
  return Array.from({ length: count }, (_, index) => ({
    front: index === 0 ? (forward ? from.right : from.left) : null,
    back: index === count - 1 ? (forward ? to.left : to.right) : null,
  }));
}

export function OpenSpread({ spreads, at, turn, onTurn }: { spreads: Spread[]; at: number; turn: Turn | null; onTurn: (to: number) => void }) {
  if (turn === null) {
    const spread = spreads[at]!;
    return (
      <div className="v2-pages">
        <PageFace page={spread.left} side="left" onCorner={at > 0 ? () => onTurn(at - 1) : undefined} />
        <PageFace page={spread.right} side="right" onCorner={at < spreads.length - 1 ? () => onTurn(at + 1) : undefined} />
      </div>
    );
  }
  const forward = turn.to > turn.from;
  const leaves = leavesOf(turn, spreads);
  const single = leaves.length === 1;
  return (
    <div className="v2-pages" data-turning={forward ? "forward" : "back"}>
      <PageFace page={spreads[forward ? turn.from : turn.to]!.left} side="left" />
      <PageFace page={spreads[forward ? turn.to : turn.from]!.right} side="right" />
      {leaves.map((leaf, index) => (
        <div
          key={index}
          className="v2-leaf"
          data-direction={forward ? "forward" : "back"}
          style={
            {
              "--leaf-delay": `${index * riffleStaggerMs}ms`,
              "--leaf-duration": `${single ? singleTurnMs : riffleTurnMs}ms`,
              "--leaf-z-from": `${(leaves.length - index) * 0.6 + 1}px`,
              "--leaf-z-to": `${index * 0.6 + 1}px`,
            } as CSSProperties
          }
        >
          <div className="v2-leaf-face v2-leaf-front">
            <PageFace page={leaf.front} side={forward ? "right" : "left"} />
          </div>
          <div className="v2-leaf-face v2-leaf-back">
            <PageFace page={leaf.back} side={forward ? "left" : "right"} />
          </div>
        </div>
      ))}
    </div>
  );
}
