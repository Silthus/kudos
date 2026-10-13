import { IconLock } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import type { ReactNode } from "react";
import type { Leaderboard } from "../leaderboardFixtures";

export function SidePanels({ board }: { board: Leaderboard }) {
  const line = improvementLineOf(board);
  return (
    <div className="flex flex-col gap-5 lg:sticky lg:top-20">
      {line !== undefined && (
        <Panel id="only-you-title" label={<><IconLock aria-hidden="true" className="size-3" /> Only you see these</>}>
          <p className="border-l-2 border-foreground/20 pl-3 tabular-nums">{line}</p>
        </Panel>
      )}
      <Panel id="how-it-counts-title" label="How it counts">
        <p className="text-muted-foreground">Only kudos given count. Kudos received, XP and levels never rank anyone.</p>
        <p>{board.onTheBoards ? "You're on the leaderboards." : "You're off the leaderboards."} You can change this in Settings in Slack's App Home.</p>
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

function improvementLineOf({ improvement, period }: Leaderboard) {
  if (improvement === null || period === "all") return undefined;
  if ("best" in improvement) return `Your best ${period} so far: ${improvement.best} kudos.`;
  const places = improvement.places === undefined ? "" : ` · ▲ ${improvement.places} places`;
  return `▲ ${improvement.gain} more kudos than this time last ${period}${places}`;
}
