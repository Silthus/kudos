import { IconLock } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import type { ReactNode } from "react";
import { improvementLine } from "../../../convex/leaderboard/improvementLine";
import type { Leaderboard, ShellActions } from "../shell";
import { VisibilitySwitch } from "./VisibilitySwitch";

type SidePanelsProps = { board: Leaderboard; onSetBoardVisibility: ShellActions["setBoardVisibility"] };

export function SidePanels({ board, onSetBoardVisibility }: SidePanelsProps) {
  const { improvement, period } = board;
  const line = improvement === null || period === "all" ? undefined : improvementLine(improvement, period);
  return (
    <div className="flex flex-col gap-5 lg:sticky lg:top-20">
      {line !== undefined && (
        <Panel id="only-you-title" label={<><IconLock aria-hidden="true" className="size-3" /> Only you see these</>}>
          <p className="border-l-2 border-foreground/20 pl-3 tabular-nums">{line}</p>
        </Panel>
      )}
      <Panel id="how-it-counts-title" label="How it counts">
        <p className="text-muted-foreground">Only kudos given count. Kudos received, XP, levels and achievements never rank anyone.</p>
        <VisibilitySwitch onTheBoards={board.onTheBoards} setBoardVisibility={onSetBoardVisibility} />
      </Panel>
    </div>
  );
}

function Panel({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3 text-sm">
          <h2 id={id} className="hud-label flex items-center gap-1">
            {label}
          </h2>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
