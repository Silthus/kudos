import { useId } from "react";
import type { Progression } from "../shell";

export function LevelLine({ progression: { level, xp, levelStartsAt, nextLevelAt, xpToNextLevel } }: { progression: Progression }) {
  const lineId = useId();
  const share = ((xp - levelStartsAt) / (nextLevelAt - levelStartsAt)) * 100;
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <p id={lineId} className="text-sm text-muted-foreground tabular-nums">
        {`Level ${level} · ${xpToNextLevel} XP to level ${level + 1}`}
      </p>
      <div
        role="progressbar"
        aria-labelledby={lineId}
        aria-valuemin={levelStartsAt}
        aria-valuemax={nextLevelAt}
        aria-valuenow={xp}
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/15"
      >
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
