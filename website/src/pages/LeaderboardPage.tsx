import { Card, CardContent } from "@posthog/quill";
import { BoardCard } from "../leaderboard/BoardCard";
import { BoardList } from "../leaderboard/BoardList";
import { EmptyBoard } from "../leaderboard/EmptyBoard";
import { PeriodSwitch } from "../leaderboard/PeriodSwitch";
import { periodNamed } from "../leaderboard/periods";
import { Podium } from "../leaderboard/Podium";
import { SidePanels } from "../leaderboard/SidePanels";
import { storyOf, type Story } from "../leaderboard/story";
import { viewerLineOf } from "../leaderboard/ViewerLine";
import type { Leaderboard } from "../leaderboardFixtures";
import { PageTitle } from "../PageTitle";
import type { Period } from "../shell";

export function LeaderboardPage({ board, onChoosePeriod }: { board: Leaderboard; onChoosePeriod: (period: Period) => void }) {
  const story = storyOf(board);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="hud-label">Leaderboard · kudos given</span>
          <PeriodSwitch period={board.period} onChoose={onChoosePeriod} />
        </div>
        <BoardCard board={board} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="board-title">
            <Card size="sm">
              <CardContent className="flex flex-col gap-6">
                <h2 id="board-title" className="hud-label">{`Everyone · ${periodNamed(board.period).label}`}</h2>
                {story === undefined ? <EmptyBoard board={board} /> : <RankedBoard board={board} story={story} />}
              </CardContent>
            </Card>
          </section>
          {story !== undefined && <BoardList board={board} after={viewerLineOf(board)} />}
        </div>
        <SidePanels board={board} />
      </div>
    </div>
  );
}

function RankedBoard({ board, story }: { board: Leaderboard; story: Story }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <PageTitle tab="Leaderboard">{story.headline}</PageTitle>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{story.deck}</p>
      </div>
      <Podium board={board} />
    </>
  );
}
