// PROTOTYPE (personal#97, round 2): the floating switcher for the item board. Never merge to main.
import { useEffect } from "react";
import { startOver } from "./itemBoardItems";
import { backs, setBoardParams, speeds, useBoardParams } from "./itemBoardParams";

export function PrototypeBar({ onStartOver }: { onStartOver: () => void }) {
  const board = useBoardParams();
  const index = backs.findIndex(({ key }) => key === board.back);
  const current = backs[index]!;
  const step = (by: number) => setBoardParams({ back: backs[(index + by + backs.length) % backs.length]!.key });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const again = () => {
    startOver();
    window.scrollTo({ top: 0, behavior: "instant" });
    onStartOver();
  };

  return (
    <div className="ib-bar" role="toolbar" aria-label="Prototype controls">
      <button type="button" onClick={() => step(-1)} aria-label="Previous back">
        ‹
      </button>
      <span className="ib-bar-variant" title={current.says}>
        <strong>
          Back {index + 1}/{backs.length}: {current.name}
        </strong>
        <span>{current.says}</span>
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next back">
        ›
      </button>
      <span className="ib-bar-rule" />
      <span className="ib-bar-group" role="group" aria-label="Speed">
        {speeds.map((speed) => (
          <button key={speed} type="button" aria-pressed={board.speed === speed} onClick={() => setBoardParams({ speed })}>
            {speed}×
          </button>
        ))}
      </span>
      <button type="button" aria-pressed={board.still} onClick={() => setBoardParams({ still: !board.still })}>
        Reduced motion
      </button>
      <span className="ib-bar-rule" />
      <button type="button" onClick={again}>
        Start over
      </button>
    </div>
  );
}
