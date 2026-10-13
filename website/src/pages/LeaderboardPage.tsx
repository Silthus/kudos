import { Card, CardContent } from "@posthog/quill";
import { BoardCard } from "../leaderboard/BoardCard";
import { PeriodSwitch } from "../leaderboard/PeriodSwitch";
import { periodNamed } from "../leaderboard/periods";
import { Podium } from "../leaderboard/Podium";
import { storyOf, type Story } from "../leaderboard/story";
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
          <Card size="sm">
            <CardContent className="flex flex-col gap-6">
              <span className="hud-label">{`Everyone · ${periodNamed(board.period).label}`}</span>
              {story && <Headline story={story} />}
              {story && <Podium board={board} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Headline({ story }: { story: Story }) {
  return (
    <div className="flex flex-col gap-2">
      <PageTitle tab="Leaderboard">{story.headline}</PageTitle>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{story.deck}</p>
    </div>
  );
}
