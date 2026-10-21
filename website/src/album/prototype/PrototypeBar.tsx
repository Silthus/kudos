// PROTOTYPE (personal#97, round 3): the floating switcher for the item board. Never merge to main.
import { startOver } from "./itemBoardItems";
import { setBoardParams, speeds, useBoardParams } from "./itemBoardParams";

export function PrototypeBar({ onStartOver }: { onStartOver: () => void }) {
  const board = useBoardParams();
  const again = () => {
    startOver();
    window.scrollTo({ top: 0, behavior: "instant" });
    onStartOver();
  };

  return (
    <div className="ib-bar" role="toolbar" aria-label="Prototype controls">
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
